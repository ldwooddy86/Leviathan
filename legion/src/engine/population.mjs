// Legion · population: every Californian in the pack as a pure function of (seed, ZIP, household, member).
//
// Nothing is stored. Household h of ZIP zi is drawn from per-ZIP models that are built lazily from the pack's
// Census tables and cached; the same (seed, zi, h, m) gives the same person everywhere.
//
// Layer 0 (householdCore) is what the GPU crowd needs, and it has to cost a few microseconds:
//   * Household structure. A household is one of ~1,400 "components": a type (B11001), a size, the
//     householder's age band (the B01001 brackets 18-19, 20-21, 22-24, then five-year bands; householders are
//     adults) and sex, and a variant (nuclear, multigenerational, extended, partner). Each component carries an
//     analytic kernel: the expected number of members it adds to each of the 46 B01001 age-sex brackets
//     (spouses near the householder's age, children at least 16 years younger, parents older, roommates). The
//     child and roommate kernels come in variants (parents younger, typical or older at a birth, or grown
//     children moved out; roommates who are peers or of mixed ages). Per ZIP an EM fits the component weights
//     and the mix of those variants together, so the single-year ages inside the bands follow the ZIP's own
//     pyramid (college towns keep their 18-21-year-olds, retirement towns their 55-64s), while exponential tilts
//     hold the household types, the mean size and the numbers of children and of people 65+ exactly (the size
//     first). Group-quarters residents (dorms, barracks, prisons, nursing homes) are not in households: when the
//     ZIP's own population clearly exceeds hh x hhsize, the excess (taken where the ZIP's pyramid exceeds its
//     neighbors' shape) is subtracted first. Totals always come from the ZIP's own counts; a small ZIP borrows
//     only shape from its county.
//   * Heritage. Race (B03002) refined by Hispanic origin (B03001), Asian group (B02015) and ancestry
//     (B04006, as relative weights) into the shared heritage keys. Household heritage depends mildly on
//     household size; the size propensities are recalibrated per ZIP so that persons reproduce B03002.
//     Spouses, children, relatives and roommates mix by simple rules mirrored in that calibration.
//   * Tenure, dwelling and vehicles: logistic tenure by type and age calibrated to own_sh; dwelling by IPF of
//     tenure against sfd_sh/mf5_sh/mh_sh; vehicles by IPF of size class against B25044 within tenure.
//   * School (B14001 rates by single year of age), work (B23025 by a national age-sex profile shifted to the
//     ZIP), active duty, occupation (C24010 by sex, IPF against an age profile that keeps teenagers out of
//     licensed work), working from home (by occupation, shifted to the ZIP's B08301 share; never in a group with
//     no remote-capable job), the other commute modes (B08301 split by car access) and travel time (B08303, IPF
//     of mode against time), and departure times from the occupation group's shift pattern (occupations.mjs).
//   * Destinations agree with the trip. A worker's mode and minutes imply a distance: a trip under 15 km ends that
//     far from the home itself, at a workplace chosen by establishments among a few directions; a longer one at a
//     ZIP chosen by a gravity model over establishments in that distance band (precomputed per ZIP). Service
//     members report to a base within reach of their trip (a ZIP where they are a quarter or more of the workers).
//     Children go to the nearest school of their level, by a mode and in minutes that follow the distance; college
//     students to a campus by a way its distance allows. No trip's minutes imply an impossible speed.
//
// Layer 1 (household, person) conditions on layer 0 and never contradicts it: nativity and arrival (B05012;
// people born in Puerto Rico, Guam or American Samoa are native born, never immigrants), language and English
// ability (C16001), job titles (occupations.mjs) and then education (B15003, never short of a title's degree),
// marital status (B12001), veterans (B21001), household income (B19001, by rank of earning power; nobody is paid
// below California's minimum wage for their hours), names (names.mjs) and the highway a driver takes. Those are
// calibrated per ZIP on a synthetic sample of the ZIP's own households. Heritage shapes names, home languages and
// the chance of having been born abroad, only through these tables; it never touches anything else.
//   * A household hangs together. Every grandchild lives with the householder's child who is their parent (layer 0
//     draws that grown child first and the grandchild at an age they could have had). Parents and brothers or
//     sisters of the spouse's heritage are the spouse's (in-laws), and a brother or sister is listed as a parent's
//     child only when the ages allow it. A child is born where their mother was: before she came here, abroad (in
//     her country, mostly in the family's town, never a refugee camp outside the years it was open), arriving with
//     her; after, here, and a parent here who arrived only later had come before. That holds for the householder's
//     own generation and their mother too, and a child born abroad is not listed as the child of a father born here
//     or of another origin (a stepfather). Nobody is born in the 50 states before their origin's community began
//     (the Hmong in 1976, Ethiopians in 1980).
//   * English: almost every US-born adult speaks it very well; less than very well (C16001) is the immigrants', the
//     more the older they came and the more recently, and young children's of immigrant homes still learning it.
//     Everyone who went to school here lists English among their languages.
//   * Names follow the family's language and origin (Punjabi, Telugu, Tamil ... families named in their own
//     language; Somali, Yoruba, Samoan ... families in their people's names, not a continent's) and each
//     tradition's household customs (who takes whose surname: kinship, names.marriedSurname; feminine surname forms
//     only for lines whose language marks them). Brothers and sisters do not share a first name.

import { Rng, hash2, hash3, mix32, u01, clamp } from './rng.mjs';
import { surname, givenName, nickname, adaptSurname, surnameCustoms, marriedSurname, sameSurnameTradition } from './names.mjs';
import { OCC_GROUPS, GROUP_PROFILES, OCCUPATION_CATALOG, MIN_WAGE_HOURLY, MIL_PAY_FLOOR, chooseTitle, titleWage } from './occupations.mjs';

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
  /** One draw from two uniforms: the first picks the column, the second its coin. */
  draw(u1, u2) { const i = Math.min(this.n - 1, (u1 * this.n) | 0); return u2 < this.prob[i] ? i : this.alias[i]; }
  /** One draw from a single uniform: its integer part picks the column, its fraction the column's coin. */
  pick(rng) { const x = rng.float() * this.n, i = Math.min(this.n - 1, x | 0); return x - i < this.prob[i] ? i : this.alias[i]; }
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

/**
 * delta such that sum_i sigmoid(k[i] * delta + off[i]) = target, for weights k[i] >= 0 (Newton steps inside a
 * shrinking bracket on [-10, 10]); a target out of reach leaves delta at the nearer end.
 */
function solveScaledShift(k, off, target) {
  let lo = -10, hi = 10, d = 0;
  for (let it = 0; it < 60; it++) {
    let f = -target, df = 0;
    for (let i = 0; i < k.length; i++) { const p = 1 / (1 + Math.exp(-(k[i] * d + off[i]))); f += p; df += k[i] * p * (1 - p); }
    if (Math.abs(f) < 1e-7 * Math.max(1, k.length)) break;
    if (f > 0) hi = d; else lo = d;
    let next = df > 1e-12 ? d - f / df : (lo + hi) / 2;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (hi - lo < 1e-9) break;
    d = next;
  }
  return d;
}

/**
 * A root of an increasing function f on [lo, hi] (a step function is fine): regula falsi with the Illinois
 * correction, stopping when |f| <= tol or the bracket is below 1e-4, at most 14 evaluations.
 */
function rootMonotone(f, lo, hi, tol) {
  let flo = f(lo), fhi = f(hi), side = 0;
  if (flo >= 0) return lo;
  if (fhi <= 0) return hi;
  // the Illinois halving keeps the scaled values (for the next secant) apart from the true ones (for the answer)
  let best = Math.abs(flo) < Math.abs(fhi) ? lo : hi, bestF = Math.min(Math.abs(flo), Math.abs(fhi));
  for (let it = 0; it < 14 && hi - lo > 1e-4; it++) {
    let x = (lo * fhi - hi * flo) / (fhi - flo);
    // a secant point stuck at an end of the bracket (a flat step of the function) gives way to bisection
    if (!(x > lo + 0.01 * (hi - lo) && x < hi - 0.01 * (hi - lo))) x = (lo + hi) / 2;
    const fx = f(x);
    if (Math.abs(fx) < bestF) { bestF = Math.abs(fx); best = x; }
    if (Math.abs(fx) <= tol) return x;
    if (fx < 0) { lo = x; flo = fx; if (side === -1) fhi /= 2; side = -1; } else { hi = x; fhi = fx; if (side === 1) flo /= 2; side = 1; }
  }
  return best;
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

// Householder bands: the B01001 brackets from 18 to 24 (where college towns and young suburbs differ most), then
// five-year bands. Householders are adults: B11001 counts a handful aged 15 to 17, too few to model.
const BAND_LO = [18, 20, 22, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
const BAND_HI = [19, 21, 24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 99];
const NBAND = BAND_LO.length;
const A0 = 18, NA = MAX_AGE - A0 + 1;
const BAND_CUM = BAND_LO.map((lo, k) => {
  const hi = BAND_HI[k], w = [];
  for (let a = lo; a <= hi; a++) w.push(k === 0 ? (a === 18 ? 0.4 : 0.6) : k === NBAND - 1 ? Math.pow(0.8, a - lo) : 1);
  const t = w.reduce((x, y) => x + y, 0);
  let c = 0;
  return Float64Array.from(w, v => (c += v / t));
});
const bandAge = (band, u) => { const cum = BAND_CUM[band]; let i = 0; while (i < cum.length - 1 && u >= cum[i]) i++; return BAND_LO[band] + i; };

// roles: 0 householder, 1 spouse, 2 partner, 3 child, 4 grandchild, 5 parent, 6 sibling, 7 relative, 8 roommate,
// 9 second parent (the other half of a parent couple; reported as 'parent'), 10 a grown child who is the parent of the
// grandchildren drawn after them (reported as 'child')
const ROLE_NAMES = ['householder', 'spouse', 'partner', 'child', 'grandchild', 'parent', 'sibling', 'relative', 'roommate', 'parent', 'child'];
const R_HH = 0, R_SPOUSE = 1, R_PARTNER = 2, R_CHILD = 3, R_GRAND = 4, R_PARENT = 5, R_SIB = 6, R_REL = 7, R_ROOM = 8, R_PARENT2 = 9, R_GPAR = 10;
const NROLE = 11;

// Member age paths relative to the householder's exact age a (x = member's age). Children and roommates come in
// variants whose mix every ZIP fits to its own pyramid: parents younger, typical or older at a birth (a young
// suburb against an affluent one), roommates who are peers (a college town) or of mixed ages. A grandchild is drawn
// from their own parent's age (P_GPC_*: the age of the grown child of the householder who is their parent here,
// P_GPAR_*); the kernel the fit uses for grandchildren (P_GC_H*) is that pair's age relative to the householder.
const P_SP_M = 0, P_SP_F = 1, P_SP_S = 2, P_PA_M = 3, P_PA_F = 4, P_PA_S = 5, P_CH_M = 6, P_CH_F = 7, P_CH_MY = 8, P_CH_FY = 9,
  P_CH_MO = 10, P_CH_FO = 11, P_CH_MM = 12, P_CH_FM = 13, P_GC_HM = 14, P_PAR = 15, P_SIB = 16, P_REL = 17, P_RM_PEER = 18, P_RM_WIDE = 19,
  P_GC_HF = 20, P_GPAR_M = 21, P_GPAR_F = 22, P_GPC_F = 23, P_GPC_M = 24;
const NPATH = 25;
// a grown child living here with their own children is more often a daughter
const GPAR_FEMALE = 0.62;
const gw = (x, mu, sd) => { const z = (x - mu) / sd; return Math.exp(-0.5 * z * z); };
const gpcCache = new Array(MAX_AGE + 1);

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
    // a child's age is the parent's age at the birth; fathers are older at a birth than mothers
    case P_CH_M: rel(-1, 31.5, 6.5, 17, 60); break;
    case P_CH_F: rel(-1, 28.5, 6.2, 16, 50); break;
    case P_CH_MY: rel(-1, 26.5, 5, 17, 55); break;
    case P_CH_FY: rel(-1, 24, 4.5, 16, 45); break;
    case P_CH_MO: rel(-1, 37, 6, 20, 62); break;
    case P_CH_FO: rel(-1, 34, 5, 18, 50); break;
    // minors only: where grown children have moved out (the typical kernel under 18; the whole kernel for a parent
    // too old to have a minor child often)
    case P_CH_MM: case P_CH_FM: {
      const full = pathWeights(p === P_CH_MM ? P_CH_M : P_CH_F, a);
      if (!full) return null;
      let m = 0; for (let x = 0; x <= 17; x++) m += full[x];
      if (m < 0.2) return full;
      for (let x = 0; x <= MAX_AGE; x++) w[x] = x <= 17 ? full[x] : 0;
      break;
    }
    case P_PAR: rel(1, 28.5, 6.5, 15, 50); break;
    case P_SIB: rel(1, 0, 6.5, -22, 22); break;
    case P_REL: rel(-1, 25, 8, 10, 50, 0.45); rel(1, 0, 10, -25, 25, 0.35); rel(1, 25, 7, 10, 45, 0.2); break;
    case P_RM_PEER: rel(1, 0, 3, -9, 9); break;
    case P_RM_WIDE: {
      rel(1, 0, 9, -28, 28, 0.65);
      let t = 0; for (let x = 18; x <= 80; x++) t += gw(x, 30, 12);
      for (let x = 18; x <= 80; x++) w[x] += 0.35 * gw(x, 30, 12) / t;
      break;
    }
    // a grown child (18 or older) who has children of their own here: the typical child kernel, weighted by how likely
    // someone that age is to have had a child (few at 18 to 20, most by 30); a householder too young for more than a
    // sliver of that (under about 41 for a mother, 44 for a father) has none
    case P_GPAR_M: case P_GPAR_F: {
      rel(-1, p === P_GPAR_M ? 31.5 : 28.5, p === P_GPAR_M ? 6.5 : 6.2, p === P_GPAR_M ? 17 : 16, p === P_GPAR_M ? 60 : 50);
      let grown = 0;
      for (let x = 0; x <= MAX_AGE; x++) { w[x] = x < 18 ? 0 : w[x] / (1 + Math.exp(-(x - 24) / 3.5)); grown += w[x]; }
      if (grown < 0.05) return null;
      break;
    }
    // a grandchild by their own parent's age a: a mother here 16 to 45 at the birth, a father 17 to 55 (younger on
    // average than parents in general: young parents more often live with their own parents)
    case P_GPC_F: rel(-1, 25.5, 5.5, 16, 45); break;
    case P_GPC_M: rel(-1, 28.5, 6.5, 17, 55); break;
    // the grandchild's age by the householder's: the grown child's kernel composed with the parent-to-child gap
    case P_GC_HM: case P_GC_HF: {
      const par = pathWeights(p === P_GC_HM ? P_GPAR_M : P_GPAR_F, a);
      if (!par) return null;
      for (let y = 18; y <= MAX_AGE; y++) {
        if (!(par[y] > 0)) continue;
        const f = gpcCache[y] || (gpcCache[y] = [pathWeights(P_GPC_F, y), pathWeights(P_GPC_M, y)]);
        for (let x = 0; x <= MAX_AGE; x++) w[x] += par[y] * (GPAR_FEMALE * (f[0] ? f[0][x] : 0) + (1 - GPAR_FEMALE) * (f[1] ? f[1][x] : 0));
      }
      break;
    }
  }
  const lo = p <= P_PA_S || p === P_RM_PEER || p === P_RM_WIDE || p === P_GPAR_M || p === P_GPAR_F ? 18 : p === P_SIB ? 3 : 0;
  for (let x = 0; x < lo; x++) w[x] = 0;
  let t = 0; for (let x = 0; x <= MAX_AGE; x++) t += w[x];
  if (t > 1e-9) for (let x = 0; x <= MAX_AGE; x++) w[x] /= t;
  return t > 1e-6 ? w : null;
}

// PATH_OK[p*NA + a-A0]; PATH_PROB / PATH_ALIAS: an alias table over member age per (path, householder age), so a
// member's age costs one uniform and two reads; PATH_K: the same kernel by B01001 bracket
const NX = MAX_AGE + 1;
const PATH_OK = new Uint8Array(NPATH * NA);
const PATH_PROB = new Float32Array(NPATH * NA * NX), PATH_ALIAS = new Uint8Array(NPATH * NA * NX);
const PATH_K = new Float64Array(NPATH * NA * NB);
for (let p = 0; p < NPATH; p++) for (let a = A0; a <= MAX_AGE; a++) {
  const w = pathWeights(p, a), q = p * NA + a - A0;
  if (!w) continue;
  PATH_OK[q] = 1;
  for (let x = 0; x <= MAX_AGE; x++) PATH_K[q * NB + BR[x]] += w[x];
  const t = new Table(w);
  PATH_PROB.set(t.prob, q * NX);
  for (let x = 0; x < NX; x++) PATH_ALIAS[q * NX + x] = t.alias[x];
}
function drawPathAge(p, a, u) {
  const off = (p * NA + a - A0) * NX, x = u * NX, i = Math.min(NX - 1, x | 0);
  return x - i < PATH_PROB[off + i] ? i : PATH_ALIAS[off + i];
}

// Role kernels: each role's age-kernel variants. A ZIP's fit chooses the mix of a role's variants (RK_PRIOR is the
// starting mix): children of younger, typical or older parents; roommates who are peers or of mixed ages.
const RK_ROLE = [R_SPOUSE, R_PARTNER, R_CHILD, R_CHILD, R_CHILD, R_CHILD, R_GRAND, R_PARENT, R_SIB, R_REL, R_ROOM, R_ROOM, R_PARENT2, R_GPAR];
const NRK = RK_ROLE.length;
const RK_REL = 9, RK_CHILD0 = 2, RK_ROOM0 = 10;
const RK_FIRST = new Int8Array(NROLE).fill(-1), RK_COUNT = new Uint8Array(NROLE);
RK_ROLE.forEach((r, k) => { if (RK_FIRST[r] < 0) RK_FIRST[r] = k; RK_COUNT[r]++; });
const RK_PRIOR = [1, 1, 0.15, 0.45, 0.15, 0.25, 1, 1, 1, 1, 0.55, 0.45, 1, 1];
const CHILD_PATHS = [[P_CH_MY, P_CH_M, P_CH_MO, P_CH_MM], [P_CH_FY, P_CH_F, P_CH_FO, P_CH_FM]];
const ROOM_PATHS = [P_RM_PEER, P_RM_WIDE];

/** (path, P(member male), weight) options of role kernel k for a householder of sex hs (0 male, 1 female). */
function rkOptions(k, hs) {
  const opp = hs === 0 ? 0 : 1;
  const role = RK_ROLE[k], v = k - RK_FIRST[role];
  switch (role) {
    case R_SPOUSE: return [[hs === 0 ? P_SP_M : P_SP_F, opp, 0.985], [P_SP_S, 1 - opp, 0.015]];
    case R_PARTNER: return [[hs === 0 ? P_PA_M : P_PA_F, opp, 0.93], [P_PA_S, 1 - opp, 0.07]];
    case R_CHILD: return [[CHILD_PATHS[hs][v], 0.515, 1]];
    case R_GPAR: return [[hs === 0 ? P_GPAR_M : P_GPAR_F, 1 - GPAR_FEMALE, 1]];
    case R_GRAND: return [[hs === 0 ? P_GC_HM : P_GC_HF, 0.515, 1]];
    case R_PARENT: return [[P_PAR, 0.34, 1]];
    case R_PARENT2: return [[P_PAR, 0.66, 1]];
    case R_SIB: return [[P_SIB, 0.5, 1]];
    case R_REL: return [[P_REL, 0.5, 1]];
    case R_ROOM: return [[ROOM_PATHS[v], hs === 0 ? 0.62 : 0.38, 1]];
  }
  return null;
}
/** True when every variant of a role is possible for a householder of sex hs and age a (else the slot is a relative). */
function roleFeasible(role, hs, a) {
  for (let k = RK_FIRST[role]; k < RK_FIRST[role] + RK_COUNT[role]; k++) for (const o of rkOptions(k, hs)) if (!PATH_OK[o[0] * NA + a - A0]) return false;
  return true;
}

// Slot mixtures (roles a slot can take, with probabilities), before and after a grown child with children of their
// own here (R_GPAR) has been drawn: grandchildren only come after their parent, so every grandchild lives with one.
// The fit counts each component's expected roles through the same two-state process (slotRoleCounts).
const MIXES = [
  [[R_SPOUSE, 1]], [[R_PARTNER, 1]], [[R_CHILD, 1]], [[R_PARENT, 1]], [[R_ROOM, 1]],
  [[R_PARENT2, 0.35], [R_CHILD, 0.65]],                                               // 5: maybe the other parent
  [[R_GPAR, 0.52], [R_REL, 0.29], [R_SIB, 0.15], [R_ROOM, 0.04]],                     // 6: first extended slot (couple)
  [[R_GPAR, 0.34], [R_CHILD, 0.4], [R_REL, 0.16], [R_SIB, 0.06], [R_ROOM, 0.04]],      // 7: further extended slots (couple)
  [[R_PARENT, 0.28], [R_SIB, 0.27], [R_GPAR, 0.35], [R_REL, 0.1]],                    // 8: first extended slot (single parent)
  [[R_GPAR, 0.31], [R_CHILD, 0.38], [R_REL, 0.15], [R_SIB, 0.11], [R_PARENT, 0.05]],   // 9: further extended slots (single)
];
// ... once a grown child with children here has been drawn, further slots are mostly those children
const MIXES_AFTER = MIXES.map((m, s) => s === 7 ? [[R_GRAND, 0.84], [R_CHILD, 0.08], [R_REL, 0.05], [R_SIB, 0.02], [R_ROOM, 0.01]]
  : s === 9 ? [[R_GRAND, 0.84], [R_CHILD, 0.08], [R_REL, 0.04], [R_SIB, 0.03], [R_PARENT, 0.01]] : m.filter(([r]) => r !== R_GPAR));
const X_SPOUSE = 0, X_PARTNER = 1, X_CHILD = 2, X_PARENT = 3, X_ROOM = 4, X_P2 = 5, X_EXT1 = 6, X_EXTN = 7, X_FEXT1 = 8, X_FEXTN = 9;
// householders under 40 have no grown children with children of their own here: their extended slots draw the rest
const GPAR_BAND_LO = 40;
const MIXES_YOUNG = MIXES.map(m => m.filter(([r]) => r !== R_GPAR));
const cumOf = m => { let c = 0; const t = m.reduce((a, r) => a + r[1], 0); return m.map(r => [r[0], (c += r[1] / t)]); };
const MIX_CUM = MIXES.map(cumOf), MIX_CUM_AFTER = MIXES_AFTER.map(cumOf), MIX_CUM_YOUNG = MIXES_YOUNG.map(cumOf);

/**
 * Expected number of each role among a component's slots (index = role), through the two-state slot process of
 * householdCore: a slot draws from MIXES until a grown child with children here has been drawn, from MIXES_AFTER
 * after (from MIXES_YOUNG throughout for a householder under 40). Feasibility (a householder too young for a role)
 * is applied per exact age by the kernels, as in the draw.
 * @param {ArrayLike<number>} slots @param {boolean} young
 */
function slotRoleCounts(slots, young) {
  const n = new Float64Array(NROLE);
  const share = (mix, s) => { const m = mix[s], t = m.reduce((a, x) => a + x[1], 0); return m.map(([r, p]) => [r, p / t]); };
  let yes = 0;
  for (const s of slots) {
    let g = 0;
    for (const [r, q] of share(young ? MIXES_YOUNG : MIXES, s)) { n[r] += (1 - yes) * q; if (r === R_GPAR) g = q; }
    for (const [r, q] of share(MIXES_AFTER, s)) n[r] += yes * q;
    yes += (1 - yes) * g;
  }
  return n;
}

// component catalog priors by householder band (the fit moves them per ZIP)
const BAND_PRIOR = [
  [0.001, 0.006, 0.009, 0.05, 0.09, 0.11, 0.115, 0.11, 0.105, 0.1, 0.09, 0.075, 0.06, 0.04, 0.022, 0.012],
  [0.004, 0.012, 0.018, 0.06, 0.08, 0.1, 0.105, 0.105, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.035, 0.03],
  [0.004, 0.012, 0.018, 0.06, 0.08, 0.1, 0.105, 0.105, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.035, 0.03],
  [0.002, 0.012, 0.018, 0.07, 0.08, 0.07, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09, 0.08, 0.07, 0.06, 0.07],
  [0.03, 0.08, 0.1, 0.22, 0.15, 0.1, 0.07, 0.055, 0.05, 0.045, 0.04, 0.03, 0.015, 0.008, 0.004, 0.003],
];
const MU_MARRIED = [0.5, 0.7, 0.7, 0.9, 1.3, 1.7, 1.8, 1.6, 1.15, 0.75, 0.5, 0.35, 0.3, 0.25, 0.25, 0.25];
const NU_FAMILY = [0.3, 0.45, 0.45, 0.6, 0.75, 0.8, 0.8, 0.7, 0.55, 0.45, 0.4, 0.35, 0.3, 0.3, 0.3, 0.3];
const ALONE_F = [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.52, 0.56, 0.6, 0.66, 0.7, 0.74];
const MAX_FAMILY = 10, MAX_ROOMS = 7;
const pois = (k, mu) => { let p = Math.exp(-mu); for (let i = 1; i <= k; i++) p *= mu / i; return p; };

const COMPS = (() => {
  const list = [];
  const rep = (x, n) => Array(Math.max(0, n)).fill(x);
  // size distributions: nuclear families by the householder's age; multigenerational and extended households are bigger
  const sizeP = (s, min, mu) => s < min ? 0 : pois(s - min, mu);
  for (let b = 0; b < NBAND; b++) {
    const old = BAND_LO[b] >= 55;
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
        list.push({ type: T_ROOM, size: s, band: b, hs: -1, v: 0, slots: rep(X_ROOM, s - 1), prior: 0.6 * sizeP(s, 2, BAND_LO[b] < 30 ? 0.55 : 0.3) });
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

// factorized kernels: group g = band*3 + hsMode (0 male, 1 female, 2 either) -> householder kernel and a kernel per role variant
const NG = NBAND * 3;
const C_GROUP = Uint8Array.from(COMPS, c => c.band * 3 + (c.hs >= 0 ? c.hs : 2));
const KERNELS = (() => {
  const KH = new Float64Array(NG * NB2), KR = new Float64Array(NG * NRK * NB2);
  for (let band = 0; band < NBAND; band++) for (const hs of [0, 1]) {
    const cum = BAND_CUM[band];
    for (let i = 0; i < cum.length; i++) {
      const a = BAND_LO[band] + i, pa = cum[i] - (i ? cum[i - 1] : 0);
      if (!(pa > 0)) continue;
      for (const g of [band * 3 + hs, band * 3 + 2]) {
        const f0 = g % 3 === 2 ? 0.5 : 1;
        KH[g * NB2 + hs * NB + BR[a]] += pa * f0;
        for (let k = 0; k < NRK; k++) {
          const opts = roleFeasible(RK_ROLE[k], hs, a) ? rkOptions(k, hs) : rkOptions(RK_REL, hs);
          const off = (g * NRK + k) * NB2;
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
      for (let j = 0; j < NB2; j++) { const v = arr[k * NB2 + j]; if (v > 1e-3 * s) { idx.push(j); val.push(v); } }
      let s2 = 0; for (let q = start; q < idx.length; q++) s2 += val[q];
      if (s2 > 0) for (let q = start; q < idx.length; q++) val[q] *= s / s2;
      off[k + 1] = idx.length;
    }
    return { off, idx: Uint8Array.from(idx), val: Float64Array.from(val) };
  };
  const H = sparse(KH, NG), R = sparse(KR, NG * NRK);
  // expected role counts per component, sparse
  const roleOff = new Uint32Array(NCOMP + 1), roleId = [], roleN = [];
  for (let c = 0; c < NCOMP; c++) {
    const n = slotRoleCounts(C_SLOTS.subarray(C_SLOT_OFF[c], C_SLOT_OFF[c + 1]), BAND_LO[C_BAND[c]] < GPAR_BAND_LO);
    for (let r = 1; r < NROLE; r++) if (n[r] > 0) { roleId.push(r); roleN.push(n[r]); }
    roleOff[c + 1] = roleId.length;
  }
  // mass of each kernel among children (0-17) and seniors (65+): the moments the fit holds per household
  const massOf = (K, q, test) => { let s = 0; for (let j = K.off[q]; j < K.off[q + 1]; j++) if (test(K.idx[j] % NB)) s += K.val[j]; return s; };
  const kid = b => b < 4, sen = b => b >= 17;
  const hK = Float64Array.from({ length: NG }, (_, g) => massOf(H, g, kid)), hS = Float64Array.from({ length: NG }, (_, g) => massOf(H, g, sen));
  const rK = Float64Array.from({ length: NG * NRK }, (_, q) => massOf(R, q, kid)), rS = Float64Array.from({ length: NG * NRK }, (_, q) => massOf(R, q, sen));
  return { H, R, roleOff, roleId: Uint8Array.from(roleId), roleN: Float64Array.from(roleN), hK, hS, rK, rS };
})();

/** A role-variant mix vector (NRK) normalized within each role. */
const OMEGA_MAX = 4;

function normalizeMix(pi) {
  for (let r = 1; r < NROLE; r++) {
    const k0 = RK_FIRST[r], n = RK_COUNT[r];
    let s = 0; for (let k = k0; k < k0 + n; k++) s += pi[k];
    for (let k = k0; k < k0 + n; k++) pi[k] = s > 0 ? pi[k] / s : 1 / n;
  }
  return pi;
}

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
function tiltMoments(w, typeShare, targets, moments, maxIter = 10) {
  const [m0, m1, m2] = moments;
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
  // the mean size comes first (households add up to the household population): when the children or seniors
  // target is out of reach (a tiny ZIP with no children in its sample) and held the joint step back, the size
  // direction alone is solved by bisection with the other two held
  if (Math.abs(cur[1] - t0) > 1e-4) {
    let lo = -12, hi = 12;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      evaluate(mid, b, c3, nxt);
      if (nxt[1] < t0) lo = mid; else hi = mid;
    }
    a = (lo + hi) / 2;
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
 * Component weights and role-variant mix for one ZIP: the household type shares exactly, mean size, children and
 * seniors per household exactly, and the rest of the age-sex pyramid t (persons per household in each of the 46
 * brackets) as closely as the structure allows, by a constrained EM between two moment tilts. The EM also fits the
 * mix of each role's age-kernel variants (when parents had their children, how alike roommates are in age), which is
 * how the single-year ages inside the bands follow the ZIP's own pyramid rather than one statewide shape.
 * @returns {{w: Float64Array, pi: Float64Array}}
 */
function fitComponents(t, typeShare, iters = 12) {
  const { H, R, roleOff, roleId, roleN, hK, hS, rK, rS } = KERNELS;
  const w = new Float64Array(NCOMP), floor = new Float64Array(NCOMP);
  for (let c = 0; c < NCOMP; c++) { w[c] = C_PRIOR[c] * typeShare[C_TYPE[c]]; floor[c] = 1e-9 * w[c]; }
  const pi = normalizeMix(Float64Array.from(RK_PRIOR));
  const targets = [0, 0, 0];
  for (let b = 0; b < NB2; b++) { targets[0] += t[b]; if (b % NB < 4) targets[1] += t[b]; else if (b % NB >= 17) targets[2] += t[b]; }
  const moments = [Float64Array.from(C_SIZE), new Float64Array(NCOMP), new Float64Array(NCOMP)];
  const mK = new Float64Array(NG * NROLE), mS = new Float64Array(NG * NROLE);
  const setMoments = () => {
    for (let g = 0; g < NG; g++) for (let r = 1; r < NROLE; r++) {
      let sk = 0, ss = 0;
      for (let k = RK_FIRST[r]; k < RK_FIRST[r] + RK_COUNT[r]; k++) { sk += pi[k] * rK[g * NRK + k]; ss += pi[k] * rS[g * NRK + k]; }
      mK[g * NROLE + r] = sk; mS[g * NROLE + r] = ss;
    }
    for (let c = 0; c < NCOMP; c++) {
      const g = C_GROUP[c];
      let kids = hK[g], sen = hS[g];
      for (let k = roleOff[c]; k < roleOff[c + 1]; k++) { const q = g * NROLE + roleId[k]; kids += roleN[k] * mK[q]; sen += roleN[k] * mS[q]; }
      moments[1][c] = kids; moments[2][c] = sen;
    }
  };
  setMoments();
  tiltMoments(w, typeShare, targets, moments, 6);
  let tTot = 0; for (let b = 0; b < NB2; b++) tTot += t[b];
  const W = new Float64Array(NG), N = new Float64Array(NG * NROLE), HG = new Float64Array(NG), RG = new Float64Array(NG * NROLE);
  const pred = new Float64Array(NB2), ratio = new Float64Array(NB2), mu = new Float64Array(5), f = new Float64Array(5).fill(1), acc = new Float64Array(NRK);
  // the last state that improved the fit, for the adaptive over-relaxation's rollback
  const sw = new Float64Array(NCOMP), spi = new Float64Array(NRK), smu = new Float64Array(5), sW = new Float64Array(NG), sN = new Float64Array(NG * NROLE), sPred = new Float64Array(NB2);
  let omega = 1, best = Infinity;
  for (let it = 0; it < iters; it++) {
    W.fill(0); N.fill(0); pred.fill(0);
    for (let c = 0; c < NCOMP; c++) {
      const wc = w[c] * f[C_TYPE[c]]; w[c] = wc;
      if (!(wc > 0)) continue;
      const g = C_GROUP[c]; W[g] += wc;
      for (let k = roleOff[c]; k < roleOff[c + 1]; k++) N[g * NROLE + roleId[k]] += wc * roleN[k];
    }
    f.fill(1);
    for (let g = 0; g < NG; g++) {
      const wg = W[g]; if (!(wg > 0)) continue;
      for (let k = H.off[g]; k < H.off[g + 1]; k++) pred[H.idx[k]] += wg * H.val[k];
    }
    for (let q = 0, g = 0, rk = 0; q < NG * NRK; q++) {
      const m = N[g * NROLE + RK_ROLE[rk]] * pi[rk];
      if (m > 0) for (let k = R.off[q], e = R.off[q + 1]; k < e; k++) pred[R.idx[k]] += m * R.val[k];
      if (++rk === NRK) { rk = 0; g++; }
    }
    // adaptive over-relaxation: a longer step while the fit (KL of the pyramid) improves, back to the last good
    // state and a plain EM step when it does not
    let pTot = 0; for (let b = 0; b < NB2; b++) pTot += pred[b];
    let kl = 0; for (let b = 0; b < NB2; b++) if (t[b] > 0) kl += t[b] * Math.log(t[b] * pTot / (tTot * Math.max(pred[b], 1e-300)));
    if (kl > best && omega > 1) {
      w.set(sw); pi.set(spi); mu.set(smu); W.set(sW); N.set(sN); pred.set(sPred); omega = 1;
    } else {
      sw.set(w); spi.set(pi); smu.set(mu); sW.set(W); sN.set(N); sPred.set(pred);
      if (it) omega = Math.min(OMEGA_MAX, omega + 1);
      best = kl;
    }
    for (let b = 0; b < NB2; b++) ratio[b] = pred[b] > 1e-12 ? t[b] / pred[b] : 1;
    acc.fill(0); RG.fill(0);
    for (let g = 0; g < NG; g++) {
      if (!(W[g] > 0)) continue;
      let s = 0; for (let k = H.off[g]; k < H.off[g + 1]; k++) s += H.val[k] * ratio[H.idx[k]];
      HG[g] = s;
    }
    for (let q = 0, g = 0, rk = 0; q < NG * NRK; q++) {
      const gr = g * NROLE + RK_ROLE[rk], n = N[gr];
      if (n > 0) {
        let v = 0; for (let k = R.off[q], e = R.off[q + 1]; k < e; k++) v += R.val[k] * ratio[R.idx[k]];
        const pv = pi[rk] * v;
        RG[gr] += pv; acc[rk] += n * pv;
      }
      if (++rk === NRK) { rk = 0; g++; }
    }
    // EM update of the component weights with each type's Lagrange multiplier for the size direction (one lagged
    // Newton step per pass); the type renormalization is applied at the start of the next pass
    for (let ty = 0; ty < 5; ty++) {
      const P = typeShare[ty]; if (!(P > 0)) continue;
      const m = mu[ty];
      let tot = 0, ds = 0;
      for (let c = T_START[ty]; c < T_START[ty + 1]; c++) {
        const wc = w[c]; if (!(wc > 0)) continue;
        const g = C_GROUP[c];
        let s = HG[g];
        for (let k = roleOff[c]; k < roleOff[c + 1]; k++) s += roleN[k] * RG[g * NROLE + roleId[k]];
        const d = C_SIZE[c] + m, x = s / d, v = Math.max(floor[c], wc * (omega === 1 ? x : omega === 2 ? x * x : omega === 3 ? x * x * x : x * x * x * x));
        w[c] = v; tot += v; ds += v / d;
      }
      if (ds > 0) mu[ty] = clamp(m + (tot - P) / (omega * ds), (ty === T_ALONE ? 1 : 2) * -1 + 0.5, 50);
      f[ty] = tot > 0 ? P / tot : 1;
    }
    // EM update of each role's variant mix (kept off the extremes: every variant stays possible)
    for (let r = 1; r < NROLE; r++) {
      const k0 = RK_FIRST[r], n = RK_COUNT[r];
      if (n < 2) continue;
      let s = 0; for (let k = k0; k < k0 + n; k++) s += acc[k];
      if (!(s > 0)) continue;
      for (let k = k0; k < k0 + n; k++) { const x = acc[k] / s / pi[k]; pi[k] = Math.max(0.02, pi[k] * (omega === 1 ? x : omega === 2 ? x * x : omega === 3 ? x * x * x : x * x * x * x)); }
    }
    normalizeMix(pi);
  }
  for (let c = 0; c < NCOMP; c++) w[c] *= f[C_TYPE[c]];
  setMoments();
  tiltMoments(w, typeShare, targets, moments, 10);
  return { w, pi };
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
const TEN_BAND = [-2.6, -2.3, -2.1, -1.5, -0.9, -0.45, -0.1, 0.15, 0.35, 0.55, 0.7, 0.85, 0.95, 1.0, 0.95, 0.8];

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
const MIL_F = 0.35;   // a woman's chance of serving, relative to a man's of her age

// occupation propensity by age band (16-24, 25-34, 35-54, 55-64, 65+), relative within band; teenagers (16-19) get
// TEEN_OCC times the 16-24 value: no licensed practice or police work, little that needs a degree
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
const TEEN_OCC = { management: 0.15, business: 0.3, computer: 0.4, engineering: 0.2, science: 0.4, social: 0.3, legal: 0.1, education: 0.6,
  practitioner: 0, healthtech: 0.3, police: 0 };
const NOB = 6;   // occupation age bands: 16-19, 20-24, 25-34, 35-54, 55-64, 65+
const occBand = a => a < 20 ? 0 : a < 25 ? 1 : a < 35 ? 2 : a < 55 ? 3 : a < 65 ? 4 : 5;
const occAgeWeight = (g, b) => b === 0 ? OCC_AGE[g][0] * (TEEN_OCC[g] ?? 1) : OCC_AGE[g][b - 1];

// commute modes (B08301 order) and the travel-time brackets (B08303)
const MODES = ['drive', 'carpool', 'bus', 'rail', 'ferry', 'taxi', 'motorcycle', 'bike', 'walk', 'other', 'wfh'];
const M_DRIVE = 0, M_CARPOOL = 1, M_TAXI = 5, M_MOTO = 6, M_WFH = 10;
const NMODE = 11;
const NOCAR_PRIOR = [0.06, 1.3, 6, 5, 3, 4, 0.2, 3.5, 4.5, 2];
// Working from home by occupation group (national log-odds, shifted per ZIP to its B08301 share); index 25 armed
// forces. A group none of whose catalog titles can be done from home (police, cooks, farmworkers, builders,
// drivers...) never works from home, so a record never shows a hands-on job done from the kitchen table; the ZIP's
// B08301 share then falls on the groups that can.
const WFH_BASE = [-0.62, -0.41, 0, -1.27, -1.1, -1.73, -0.85, -2.44, -0.85, -3.4, -3.18, -3.3, -5.5, -4.6, -5.5, -3.48,
  -3.0, -1.73, -1.39, -2.75, -3.18, -3.48, -4.6, -3.89, -4.18, -4.6];
const WFH_LOGIT = Float64Array.from([...OCC_GROUPS, 'military'], (g, i) => OCCUPATION_CATALOG[g].some(t => t.wfh > 0) ? WFH_BASE[i] : -40);
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
const M_BUS = 2, M_RAIL = 3, M_BIKE = 7, M_WALK = 8;
// Road distance per straight-line km, and the fastest each mode covers it (km/h, door to door) after its fixed
// minutes: a trip's minutes never fall below what its destination needs, so nobody walks at a jogging pace or
// drives faster than the freeway allows
const ROAD = 1.25;
const VMAX = [95, 95, 32, 60, 40, 60, 100, 18, 5.5, 60];
const OVER_MIN = [2, 3, 6, 8, 12, 4, 2, 1, 0, 4];
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

// A parent is 16 to 45 years older than their child (a father up to 55): a grandchild's parent here is drawn first
// and the grandchild by this rule (P_GPC_*), and layer 1 finds that parent again by it (pickGrandParents).
const PARENT_MIN_GAP = 16;
const parentGapOk = (parentAge, parentFemale, childAge) => { const d = parentAge - childAge; return d >= PARENT_MIN_GAP && d <= (parentFemale ? 45 : 55); };
// A member in the 'parent' role is listed as a sibling's (or a spouse's) parent only from 14 years older, a mother at
// most 47 and a father 62 years older; layer 0 draws siblings' ages inside that window (fitSiblings).
const kinGapOk = (parentAge, parentFemale, childAge) => { const d = parentAge - childAge; return d >= 14 && d <= (parentFemale ? 47 : 62); };
// Who is on the spouse's side: the 'parent' and 'sibling' members who carry the spouse's (or partner's) heritage
// when it is not the householder's (parents- and siblings-in-law). Layer 0 draws them so, layer 1 reads them so.
const inLawHer = (her, H, S) => S >= 0 && S !== H && her === S;

/**
 * A brother or sister living with parents here is their child: a sibling drawn at an age the parents on their side
 * (the householder's, or the spouse's for a sibling-in-law) could not have had is drawn again from the sibling
 * kernel, up to four times (kinship lists the parent only when the ages allow it either way).
 * @param {Uint8Array} roles @param {Uint8Array} sexes 0 male, 1 female @param {Uint8Array} ages @param {Uint8Array} hers
 * @param {number} n members @param {number} H the householder's heritage @param {number} S the spouse's or -1
 * @param {Rng} r the household's generator
 */
function fitSiblings(roles, sexes, ages, hers, n, H, S, r) {
  for (let s = 1; s < n; s++) {
    if (roles[s] !== R_SIB) continue;
    const side = inLawHer(hers[s], H, S);
    const fits = x => {
      for (let p = 1; p < n; p++) if ((roles[p] === R_PARENT || roles[p] === R_PARENT2) && inLawHer(hers[p], H, S) === side && !kinGapOk(ages[p], sexes[p], x)) return false;
      return true;
    };
    for (let t = 0; t < 4 && !fits(ages[s]); t++) ages[s] = drawPathAge(P_SIB, ages[0], r.float());
  }
}

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
// scratch for _workNear's candidate workplaces (x, y, zi, weight)
const SCR_CAND = new Float64Array(16);
// scratch for householdCore's member loop (households have at most MAX_FAMILY members)
const SCR_ROLE = new Uint8Array(MAX_FAMILY), SCR_SEX = new Uint8Array(MAX_FAMILY), SCR_AGE = new Uint8Array(MAX_FAMILY), SCR_HER = new Uint8Array(MAX_FAMILY);
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

/** Typical door-to-door speed (km/h of road) of a mode; driving is slower in dense places. */
const tripSpeed = (mi, urban) => SPEED[mi] * (mi === M_DRIVE || mi === M_CARPOOL || mi === M_MOTO || mi === M_TAXI ? 1 - 0.3 * urban : 1);

/** Typical one-way straight-line distance (km) covered by a mode in a given time (its road distance over ROAD). */
function tripKm(mi, minutes, urban) { return tripSpeed(mi, urban) * Math.max(1, minutes - OVERHEAD[mi]) / 60 / ROAD; }

/**
 * How much farm country a ZIP of a given density (people per square mile) is: the weight its workplaces get for a
 * farming worker (fields, orchards, dairies and ranches are where few people live; a dense city ZIP has almost none).
 */
const FARM_LAND = density => (density > 800 ? Math.pow(800 / density, 2) : 1);

/** Index of the point in S (x, y pairs) whose straight-line distance from home is closest to D km. */
function siteNear(S, home, D, M) {
  let best = 0, bd = Infinity;
  for (let k = 0, K = S.length >> 1; k < K; k++) {
    const dx = (S[2 * k] - home.x) * M.kx, dy = (S[2 * k + 1] - home.y) * M.ky, e = Math.abs(Math.sqrt(dx * dx + dy * dy) - D);
    if (e < bd) { bd = e; best = k; }
  }
  return best;
}

// California's active-duty installations (public places): [name, lat, lon, radius km of the installation and its
// training ranges, branch mix of the members who report there]. A service member's branch is the installation's
// they report to (layer 1): most of a base's members are of its own service, Navy corpsmen serve with the Marines,
// the language school and the postgraduate school in Monterey train every service. Members who work off base
// (recruiters, reserve centers, headquarters) keep occupations.mjs's place affinities.
const INSTALLATIONS = [
  ['Camp Pendleton', 33.35, -117.40, 22, { marines: 0.88, navy: 0.12 }],
  ['Marine Corps Air Station Miramar', 32.868, -117.142, 6, { marines: 0.93, navy: 0.07 }],
  ['Marine Corps Recruit Depot San Diego', 32.741, -117.197, 1.5, { marines: 0.95, navy: 0.05 }],
  ['Marine Corps Air Ground Combat Center Twentynine Palms', 34.30, -116.15, 35, { marines: 0.9, navy: 0.1 }],
  ['Marine Corps Logistics Base Barstow', 34.86, -116.92, 6, { marines: 0.9, navy: 0.05, army: 0.05 }],
  ['Marine Corps Mountain Warfare Training Center', 38.355, -119.52, 12, { marines: 0.95, navy: 0.05 }],
  ['Naval Base San Diego', 32.684, -117.129, 2.5, { navy: 0.95, marines: 0.03, coastguard: 0.02 }],
  ['Naval Air Station North Island', 32.699, -117.215, 3, { navy: 0.96, marines: 0.02, coastguard: 0.02 }],
  ['Naval Amphibious Base Coronado', 32.677, -117.161, 3, { navy: 0.93, marines: 0.07 }],
  ['Naval Base Point Loma', 32.693, -117.243, 2.5, { navy: 0.9, coastguard: 0.1 }],
  ['Naval Medical Center San Diego', 32.726, -117.145, 1.2, { navy: 0.97, marines: 0.03 }],
  ['Naval Air Station Lemoore', 36.333, -119.952, 12, { navy: 0.92, marines: 0.08 }],
  ['Naval Air Weapons Station China Lake', 35.685, -117.69, 20, { navy: 0.9, marines: 0.05, airforce: 0.05 }],
  ['Naval Base Ventura County, Point Mugu', 34.12, -119.12, 6, { navy: 0.95, coastguard: 0.05 }],
  ['Naval Base Ventura County, Port Hueneme', 34.162, -119.207, 2.5, { navy: 0.97, coastguard: 0.03 }],
  ['Naval Weapons Station Seal Beach', 33.744, -118.087, 3, { navy: 1 }],
  ['Naval Air Facility El Centro', 32.829, -115.672, 5, { navy: 0.9, marines: 0.1 }],
  ['Naval Postgraduate School', 36.597, -121.875, 1.2, { navy: 0.6, marines: 0.12, army: 0.12, airforce: 0.1, coastguard: 0.06 }],
  ['Defense Language Institute, Presidio of Monterey', 36.604, -121.909, 1.5, { army: 0.4, airforce: 0.3, navy: 0.15, marines: 0.15 }],
  ['Fort Irwin National Training Center', 35.26, -116.68, 45, { army: 0.95, airforce: 0.05 }],
  ['Fort Hunter Liggett', 35.96, -121.23, 25, { army: 1 }],
  ['Edwards Air Force Base', 34.905, -117.884, 22, { airforce: 0.95, army: 0.03, navy: 0.02 }],
  ['Travis Air Force Base', 38.263, -121.927, 6, { airforce: 0.97, army: 0.02, navy: 0.01 }],
  ['Beale Air Force Base', 39.136, -121.436, 12, { airforce: 1 }],
  ['Vandenberg Space Force Base', 34.742, -120.573, 22, { spaceforce: 0.55, airforce: 0.45 }],
  ['Los Angeles Air Force Base', 33.919, -118.381, 1.5, { spaceforce: 0.7, airforce: 0.3 }],
  ['Coast Guard Island, Alameda', 37.782, -122.249, 1, { coastguard: 1 }],
  ['Coast Guard Training Center Petaluma', 38.253, -122.75, 4, { coastguard: 1 }],
  ['Coast Guard Air Station Sacramento', 38.668, -121.40, 2, { coastguard: 1 }],
  ['Coast Guard Air Station San Francisco', 37.632, -122.384, 1, { coastguard: 1 }],
  ['Coast Guard Sector Humboldt Bay', 40.976, -124.112, 3, { coastguard: 1 }],
  ['Coast Guard Base Los Angeles-Long Beach', 33.723, -118.272, 1.5, { coastguard: 1 }],
].map(([name, lat, lon, km, mix]) => ({ name, lat, lon, km, branches: Object.keys(mix), cum: (() => { let c = 0; const t = Object.values(mix).reduce((a, b) => a + b, 0); return Object.values(mix).map(v => (c += v / t)); })() }));

// ------------------------------------------------------------------ layer 1 data: origins, languages, birthplaces

// Home-language keys by C16001 bucket, in the pack's order (world.acsLabels('lang')): 0 English only, 1 Spanish,
// 2 French, 3 German and West Germanic, 4 Slavic, 5 other Indo-European, 6 Korean, 7 Chinese, 8 Vietnamese,
// 9 Tagalog, 10 other Asian and Pacific Island, 11 Arabic, 12 other.
const LANG_BUCKET_OF = {};
for (const [b, list] of Object.entries({
  0: 'english', 1: 'spanish', 2: 'french haitian', 3: 'german dutch yiddish afrikaans',
  4: 'russian ukrainian polish serbian croatian czech bulgarian',
  5: 'portuguese italian greek armenian farsi dari pashto hindi urdu punjabi gujarati bengali marathi nepali sinhala romanian albanian swedish norwegian danish catalan',
  6: 'korean', 7: 'cantonese mandarin taishanese hokkien', 8: 'vietnamese', 9: 'tagalog',
  10: 'japanese hmong khmer lao mien thai telugu tamil malayalam kannada burmese karen indonesian malay ilocano cebuano samoan tongan chamorro fijian hawaiian marshallese mongolian',
  11: 'arabic',
  12: 'assyrian amharic tigrinya oromo somali hebrew turkish hungarian yoruba igbo swahili twi wolof navajo mixtec zapotec triqui kiche mam qanjobal basque finnish uzbek',
})) for (const k of list.split(' ')) LANG_BUCKET_OF[k] = +b;

// origin: [heritage, label, foreign-born share, home-language retention beyond the second generation,
//          home-language use among immigrants and their children (relative), earliest arrival year,
//          languages 'key:weight ...', birthplaces 'Place:weight@langs#from-to|...' (#from-to: the only years anyone of
//          the origin was born there: a refugee camp's, a city the community left, like the Armenians of Baku by 1990
//          and the Christians of Mosul in 2014), share of US-born adults born in a territory]
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
  indian: ['indian', 'Indian American', 0.65, 0.08, 0.85, 1950, 'hindi:.30 punjabi:.20 telugu:.15 tamil:.10 gujarati:.09 malayalam:.05 marathi:.03 bengali:.03 kannada:.03 urdu:.02', 'New Delhi, India:4@hindi,punjabi|Lucknow, India:1@hindi,urdu|Jaipur, India:1@hindi|Kanpur, India:0.5@hindi|Patna, India:0.6@hindi|Bhopal, India:0.5@hindi,urdu|Indore, India:0.5@hindi|Varanasi, India:0.4@hindi|Chandigarh, India:1@punjabi,hindi|Ludhiana, Punjab, India:2@punjabi|Jalandhar, Punjab, India:2@punjabi|Amritsar, Punjab, India:1@punjabi|Patiala, Punjab, India:0.6@punjabi|Mumbai, India:3@hindi,marathi,gujarati|Pune, India:1.2@marathi|Nagpur, India:0.6@marathi|Nashik, India:0.3@marathi|Ahmedabad, Gujarat, India:2@gujarati|Vadodara, Gujarat, India:1@gujarati|Surat, Gujarat, India:0.8@gujarati|Anand, Gujarat, India:0.6@gujarati|Rajkot, Gujarat, India:0.5@gujarati|Hyderabad, India:3@telugu,urdu|Vijayawada, India:1@telugu|Guntur, India:0.7@telugu|Visakhapatnam, India:0.7@telugu|Warangal, India:0.4@telugu|Tirupati, India:0.4@telugu|Bengaluru, India:3@kannada,tamil,telugu|Mysuru, India:0.5@kannada|Mangaluru, India:0.5@kannada|Hubballi, India:0.3@kannada|Chennai, India:3@tamil|Coimbatore, India:1@tamil|Madurai, India:0.6@tamil|Tiruchirappalli, India:0.4@tamil|Kolkata, India:1.5@bengali|Durgapur, India:0.3@bengali|Siliguri, India:0.2@bengali|Kochi, Kerala, India:1@malayalam|Thiruvananthapuram, Kerala, India:0.8@malayalam|Kottayam, Kerala, India:0.7@malayalam|Thrissur, Kerala, India:0.5@malayalam|Kozhikode, Kerala, India:0.3@malayalam|Aligarh, India:0.3@urdu'],
  sikh: ['sikh', 'Punjabi Sikh American', 0.6, 0.12, 1, 1900, 'punjabi:1', 'Ludhiana, Punjab, India:3|Jalandhar, Punjab, India:3|Amritsar, Punjab, India:2|Hoshiarpur, Punjab, India:2|Patiala, Punjab, India:1'],
  hmong: ['hmong', 'Hmong American', 0.35, 0.3, 1, 1976, 'hmong:1', 'Xieng Khouang, Laos:3|Luang Prabang, Laos:2|Long Cheng, Laos:1#1962-1975|Ban Vinai refugee camp, Thailand:3#1975-1992|Chiang Kham refugee camp, Thailand:1#1976-1992|Wat Tham Krabok, Thailand:2#1992-2005'],
  cambodian: ['cambodian', 'Cambodian American', 0.45, 0.15, 1, 1975, 'khmer:1', 'Phnom Penh, Cambodia:4|Battambang, Cambodia:3|Siem Reap, Cambodia:1|Kampong Cham, Cambodia:1|Khao-I-Dang refugee camp, Thailand:2#1979-1993'],
  lao: ['lao', 'Lao American', 0.45, 0.15, 1, 1975, 'lao:1', 'Vientiane, Laos:4|Savannakhet, Laos:2|Pakse, Laos:1|Luang Prabang, Laos:1|Nong Khai refugee camp, Thailand:1#1975-1992'],
  mien: ['lao', 'Iu Mien American', 0.45, 0.2, 1, 1978, 'mien:1', 'Nan Province, Thailand:2|Luang Namtha, Laos:2|Chiang Kham refugee camp, Thailand:1#1976-1992'],
  thai: ['thai', 'Thai American', 0.62, 0.08, 0.9, 1965, 'thai:1', 'Bangkok, Thailand:5|Chiang Mai, Thailand:1|Udon Thani, Thailand:1|Khon Kaen, Thailand:1'],
  pakistani: ['pakistani', 'Pakistani American', 0.6, 0.1, 0.9, 1965, 'urdu:.6 punjabi:.3 pashto:.1', 'Karachi, Pakistan:4@urdu|Hyderabad, Sindh, Pakistan:0.6@urdu|Lahore, Pakistan:3@punjabi,urdu|Islamabad, Pakistan:2@urdu,punjabi|Rawalpindi, Pakistan:1@punjabi,urdu|Faisalabad, Pakistan:1@punjabi|Gujranwala, Pakistan:0.6@punjabi|Sialkot, Pakistan:0.5@punjabi|Multan, Pakistan:0.5@punjabi|Peshawar, Pakistan:1@pashto|Mardan, Pakistan:0.4@pashto|Quetta, Pakistan:0.4@pashto,urdu'],
  bangladeshi: ['bangladeshi', 'Bangladeshi American', 0.65, 0.1, 0.95, 1975, 'bengali:1', 'Dhaka, Bangladesh:4|Chittagong, Bangladesh:2|Sylhet, Bangladesh:2'],
  afghan: ['afghan', 'Afghan American', 0.6, 0.15, 1, 1979, 'dari:.65 pashto:.35', 'Kabul, Afghanistan:5@dari,pashto|Herat, Afghanistan:2@dari|Mazar-i-Sharif, Afghanistan:1@dari|Kandahar, Afghanistan:1@pashto|Jalalabad, Afghanistan:1@pashto|Peshawar, Pakistan:1@pashto,dari'],
  burmese: ['burmese', 'Burmese American', 0.75, 0.12, 1, 1985, 'burmese:.75 karen:.25', 'Yangon, Myanmar:4@burmese|Mandalay, Myanmar:2@burmese|Hpa-an, Myanmar:1@karen|Mae La refugee camp, Thailand:1@karen#1984-2026'],
  indonesian: ['indonesian', 'Indonesian American', 0.7, 0.08, 0.85, 1965, 'indonesian:1', 'Jakarta, Indonesia:4|Surabaya, Indonesia:2|Bandung, Indonesia:1|Medan, Indonesia:1|Manado, Indonesia:1'],
  nepali: ['asian', 'Nepali American', 0.75, 0.1, 0.95, 1990, 'nepali:1', 'Kathmandu, Nepal:3|Pokhara, Nepal:1'],
  srilankan: ['asian', 'Sri Lankan American', 0.7, 0.08, 0.9, 1975, 'sinhala:.75 tamil:.25', 'Colombo, Sri Lanka:3|Kandy, Sri Lanka:1@sinhala|Jaffna, Sri Lanka:1@tamil'],
  malaysian: ['asian', 'Malaysian American', 0.7, 0.08, 0.8, 1975, 'malay:.55 cantonese:.45', 'Kuala Lumpur, Malaysia:3|Penang, Malaysia:1@cantonese|Johor Bahru, Malaysia:1'],
  mongolian: ['asian', 'Mongolian American', 0.75, 0.1, 1, 1992, 'mongolian:1', 'Ulaanbaatar, Mongolia:1'],
  singaporean: ['asian', 'Singaporean American', 0.7, 0.05, 0.6, 1970, 'mandarin:.6 malay:.2 tamil:.2', 'Singapore:1'],
  bhutanese: ['asian', 'Bhutanese American', 0.8, 0.15, 1, 2008, 'nepali:1', 'Beldangi refugee camp, Nepal:2#1991-2026|Samtse, Bhutan:1#1900-1992|Sarpang, Bhutan:1#1900-1992|Tsirang, Bhutan:1#1900-1992'],
  uzbek: ['asian', 'Uzbek American', 0.75, 0.1, 1, 1992, 'uzbek:.6 russian:.4', 'Tashkent, Uzbekistan:2|Samarkand, Uzbekistan:1'],
  asianamerican: ['asian', 'Asian American', 0.35, 0.05, 0.6, 1900, 'mandarin:.3 tagalog:.2 korean:.2 vietnamese:.15 hindi:.15', 'Manila, Philippines:1@tagalog|Taipei, Taiwan:1@mandarin|Seoul, South Korea:1@korean|Saigon, Vietnam:1@vietnamese|New Delhi, India:1@hindi'],
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
  somali: ['african', 'Somali American', 0.65, 0.15, 1, 1991, 'somali:1', 'Mogadishu, Somalia:3|Hargeisa, Somalia:1|Kismayo, Somalia:1|Dadaab refugee camp, Kenya:1#1991-2026'],
  kenyan: ['african', 'Kenyan American', 0.65, 0.05, 0.6, 1975, 'swahili:1', 'Nairobi, Kenya:4|Mombasa, Kenya:1|Kisumu, Kenya:1'],
  ghanaian: ['african', 'Ghanaian American', 0.65, 0.05, 0.6, 1975, 'twi:1', 'Accra, Ghana:3|Kumasi, Ghana:2'],
  southafrican: ['african', 'South African American', 0.7, 0.03, 0.3, 1965, 'afrikaans:1', 'Johannesburg, South Africa:3|Cape Town, South Africa:2|Durban, South Africa:1|Pretoria, South Africa:1'],
  cameroonian: ['african', 'Cameroonian American', 0.7, 0.05, 0.7, 1985, 'french:1', 'Douala, Cameroon:2|Yaoundé, Cameroon:2|Bamenda, Cameroon:1'],
  sudanese: ['african', 'Sudanese American', 0.7, 0.1, 0.9, 1990, 'arabic:1', 'Khartoum, Sudan:3|Omdurman, Sudan:1'],
  ugandan: ['african', 'Ugandan American', 0.7, 0.03, 0.4, 1975, 'swahili:1', 'Kampala, Uganda:2|Entebbe, Uganda:1'],
  liberian: ['african', 'Liberian American', 0.7, 0, 0, 1985, '', 'Monrovia, Liberia:2'],
  senegalese: ['african', 'Senegalese American', 0.75, 0.08, 0.9, 1985, 'wolof:.6 french:.4', 'Dakar, Senegal:3|Thiès, Senegal:1'],
  armenian: ['armenian', 'Armenian American', 0.6, 0.2, 1, 1900, 'armenian:.9 russian:.1', 'Yerevan, Armenia:6@armenian,russian|Gyumri, Armenia:2|Vanadzor, Armenia:1|Tehran, Iran:3@armenian,farsi|Beirut, Lebanon:2@armenian,arabic|Aleppo, Syria:2@armenian,arabic|Baku, Azerbaijan:1@armenian,russian#1900-1990|Moscow, Russia:1@russian'],
  iranian: ['iranian', 'Iranian American', 0.65, 0.1, 0.95, 1960, 'farsi:1', 'Tehran, Iran:8|Shiraz, Iran:2|Isfahan, Iran:2|Mashhad, Iran:1|Tabriz, Iran:1|Rasht, Iran:1'],
  egyptian: ['arab', 'Egyptian American', 0.6, 0.1, 0.9, 1960, 'arabic:1', 'Cairo, Egypt:4|Alexandria, Egypt:2|Asyut, Egypt:1'],
  lebanese: ['arab', 'Lebanese American', 0.5, 0.1, 0.85, 1900, 'arabic:1', 'Beirut, Lebanon:4|Tripoli, Lebanon:1|Zahle, Lebanon:1|Sidon, Lebanon:1'],
  iraqi: ['arab', 'Iraqi American', 0.65, 0.12, 0.95, 1970, 'arabic:1', 'Baghdad, Iraq:4|Basra, Iraq:2|Mosul, Iraq:1'],
  syrian: ['arab', 'Syrian American', 0.6, 0.1, 0.95, 1960, 'arabic:1', 'Damascus, Syria:3|Aleppo, Syria:2|Homs, Syria:1'],
  palestinian: ['arab', 'Palestinian American', 0.55, 0.12, 0.95, 1950, 'arabic:1', 'Ramallah, West Bank:2|Nablus, West Bank:1|Gaza City, Gaza:1|Amman, Jordan:1'],
  jordanian: ['arab', 'Jordanian American', 0.6, 0.1, 0.95, 1960, 'arabic:1', 'Amman, Jordan:3|Irbid, Jordan:1|Zarqa, Jordan:1'],
  yemeni: ['arab', 'Yemeni American', 0.65, 0.15, 1, 1965, 'arabic:1', 'Sanaa, Yemen:2|Ibb, Yemen:1|Aden, Yemen:1'],
  arab: ['arab', 'Arab American', 0.5, 0.1, 0.9, 1900, 'arabic:1', 'Beirut, Lebanon:1|Cairo, Egypt:1|Baghdad, Iraq:1|Damascus, Syria:1|Amman, Jordan:1'],
  assyrian: ['assyrian', 'Assyrian American', 0.6, 0.2, 1, 1900, 'assyrian:.85 arabic:.15', 'Baghdad, Iraq:3|Kirkuk, Iraq:1|Mosul, Iraq:1#1900-2014|Urmia, Iran:2|Tehran, Iran:2|Qamishli, Syria:1'],
  chaldean: ['assyrian', 'Chaldean American', 0.6, 0.2, 1, 1950, 'assyrian:.6 arabic:.4', 'Baghdad, Iraq:3@arabic,assyrian|Telkaif, Iraq:2@assyrian|Mosul, Iraq:1#1900-2014|Alqosh, Iraq:1@assyrian'],
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
  // American Indian (non-Hispanic): California's own tribes, people of tribes from elsewhere (the Navajo Nation, the
  // Southwest, Oklahoma, the Plains: some speak their language at home), and Indigenous Mexican and Maya immigrants
  // who report as American Indian, with their own languages
  californiatribal: ['native', 'Native American', 0, 0, 0, 1900, '', ''],
  tribal: ['native', 'Native American', 0, 0.06, 0.5, 1900, 'navajo:1', ''],
  indigenousmexican: ['native', 'Indigenous Mexican American', 0.6, 0.25, 1, 1980, 'mixtec:.45 zapotec:.32 triqui:.1 spanish:.13', 'Santiago Juxtlahuaca, Oaxaca:3@mixtec|Tlaxiaco, Oaxaca:2@mixtec|San Juan Copala, Oaxaca:1@triqui|Oaxaca, Oaxaca:2@zapotec|Juchitán, Oaxaca:1@zapotec|Tlapa, Guerrero:1@mixtec'],
  maya: ['native', 'Maya American', 0.65, 0.25, 1, 1980, 'mam:.45 kiche:.3 qanjobal:.15 spanish:.1', 'Huehuetenango, Guatemala:3@mam,qanjobal|Todos Santos Cuchumatán, Guatemala:1@mam|Quetzaltenango, Guatemala:2@kiche|Totonicapán, Guatemala:1@kiche'],
  samoan: ['pacific', 'Samoan American', 0.15, 0.15, 0.95, 1950, 'samoan:1', 'Apia, Samoa:1', 0.3],
  tongan: ['pacific', 'Tongan American', 0.4, 0.15, 1, 1965, 'tongan:1', "Nuku'alofa, Tonga:3|Neiafu, Tonga:1"],
  nativehawaiian: ['pacific', 'Native Hawaiian', 0, 0.002, 0.02, 1900, 'hawaiian:1', ''],
  chamorro: ['pacific', 'Chamorro American', 0, 0.05, 0.6, 1950, 'chamorro:1', '', 0.5],
  fijian: ['pacific', 'Fijian American', 0.6, 0.12, 0.95, 1970, 'hindi:.55 fijian:.45', 'Suva, Fiji:3@fijian,hindi|Lautoka, Fiji:2@hindi|Nadi, Fiji:1@hindi'],
  marshallese: ['pacific', 'Marshallese American', 0.7, 0.2, 1, 1990, 'marshallese:1', 'Majuro, Marshall Islands:2|Ebeye, Marshall Islands:1'],
  pacificislander: ['pacific', 'Pacific Islander American', 0.3, 0.1, 0.8, 1950, 'samoan:.5 tongan:.5', 'Apia, Samoa:1|Suva, Fiji:1'],
  multiracial: ['multiracial', 'Multiracial', 0.1, 0, 0, 1900, '', 'Manila, Philippines:1|Mexico City:1|Seoul, South Korea:1|London, England:1'],
  otherrace: ['other', 'American', 0.3, 0.05, 0.5, 1900, 'spanish:.5 portuguese:.5', 'São Paulo, Brazil:1@portuguese|Mexico City:1@spanish|Lima, Peru:1@spanish'],
};
// Births in the US territories (US citizens or nationals by birth, so native born, never immigrants): where, how many
// of the origin's US-born adults were born there (the origin row's last field), how often they speak the heritage
// language at home, and whether their English is like an immigrant's (Puerto Rico: Spanish first) or a native's.
// Hawaii is a state: Native Hawaiians born there are simply born in another state.
const TERRITORY_BIRTH = {
  puertorican: ['San Juan, Puerto Rico:4|Bayamón, Puerto Rico:2|Ponce, Puerto Rico:2|Carolina, Puerto Rico:1|Mayagüez, Puerto Rico:1', 0.85, 'immigrant'],
  samoan: ['Pago Pago, American Samoa:1', 0.5, 'native'],
  chamorro: ['Hagåtña, Guam:2|Dededo, Guam:1|Saipan, Northern Mariana Islands:1', 0.5, 'native'],
};
// US-born outside California: states an origin's people come from more often than most, and origins rooted here
const ORIGIN_US = {
  tribal: { boost: 'Arizona:12|New Mexico:12|Oklahoma:8|South Dakota:4|Montana:3|North Dakota:2|Washington:2|Nevada:2' },
  nativehawaiian: { boost: 'Hawaii:40' },
  californiatribal: { inCA: 0.95 },
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
  american: 'american', native: 'californiatribal:55 tribal:35 indigenousmexican:7 maya:3', pacific: 'samoan:30 tongan:18 nativehawaiian:22 chamorro:12 fijian:12 marshallese:3 pacificislander:3',
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
// 'Place:weight@lang,lang#from-to': a birthplace, its weight, the languages spoken there and, for a place that
// existed only for a time (a refugee camp, a wartime town), the years someone could be born there
const parsePlaces = s => s ? s.split('|').map(p => {
  const yr = /#(\d{4})-(\d{4})$/.exec(p), item = yr ? p.slice(0, yr.index) : p;
  const [rest, tags] = item.split('@'), i = rest.lastIndexOf(':');
  return { name: rest.slice(0, i), w: +rest.slice(i + 1), tags: tags ? tags.split(',') : [], from: yr ? +yr[1] : 0, to: yr ? +yr[2] : 0 };
}) : [];

/** Origins (fine-grained heritage detail): key, heritage, label, foreign-born logit, languages, birthplaces. */
const ORIGINS = Object.entries(ORIGIN_ROWS).map(([key, r], index) => {
  const langs = parseWeights(r[6]).filter(([k]) => LANG_BUCKET_OF[k] !== undefined && k !== 'english');
  const lt = langs.reduce((a, l) => a + l[1], 0);
  return {
    // an origin with no foreign birthplaces (Native Hawaiians, Puerto Ricans, California tribes) is never foreign born
    key, index, heritage: r[0], label: r[1], fb: r[2], beta: r[2] > 0 && r[7] ? logit(clamp(r[2], 0.002, 0.95)) - 0.3 : -40, retain: r[3], use: r[4], since: r[5],
    langs: langs.map(([k, v]) => ({ key: k, w: v / (lt || 1), bucket: LANG_BUCKET_OF[k] })),
    places: parsePlaces(r[7]), territory: r[8] || 0, territoryPlaces: parsePlaces(TERRITORY_BIRTH[key] ? TERRITORY_BIRTH[key][0] : ''),
    terrLang: TERRITORY_BIRTH[key] ? TERRITORY_BIRTH[key][1] : 0, terrNative: TERRITORY_BIRTH[key] ? TERRITORY_BIRTH[key][2] === 'native' : false,
    usBoost: ORIGIN_US[key] && ORIGIN_US[key].boost ? Object.fromEntries(parsePlaces(ORIGIN_US[key].boost).map(pl => [pl.name, pl.w])) : null,
    inCA: ORIGIN_US[key] && ORIGIN_US[key].inCA || 0,
  };
});
const ORIGIN_INDEX = Object.fromEntries(ORIGINS.map(o => [o.key, o.index]));

/**
 * An origin (npc.origin, the finer heritage behind a heritage key): its heritage key, its label, the year its US
 * community began (nobody of it is born in the 50 states earlier: the Hmong in 1976, Ethiopians in 1980) and the
 * share of its Californians born abroad; null for an unknown key.
 * @param {string} key e.g. 'hmong', 'taiwanese', 'eritrean'
 * @returns {{key: string, heritage: string, label: string, since: number, foreignShare: number}|null}
 */
export function originInfo(key) {
  if (typeof key !== 'string' || !Object.hasOwn(ORIGIN_INDEX, key)) return null;
  const o = ORIGINS[ORIGIN_INDEX[key]];
  return { key: o.key, heritage: o.heritage, label: o.label, since: o.since, foreignShare: o.fb };
}
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

// attribute codes of the hashed uniforms (household seed, member, attribute)
const KA = { ORIGIN: 1, NAT: 2, NATH: 3, ARR: 4, GEN: 5, BORN: 6, BORN2: 7, LCHOICE: 8, LANG: 9, LANGH: 10, CROSS: 11, LEP: 12, EDU: 13, MAR: 15, VET: 17, UNEMP: 18, STATUS: 19, INC: 20, OCC: 21, NAME: 22, MOVED: 23, BUILT: 24, BDAY: 25, LIST: 26, SPAN: 27, TERR: 28, ARR2: 29, SIKH: 30, CUSTOM: 31, TOWN: 32, BRANCH: 33, OLD: 34 };
const uni = (hs, m, k) => u01(hash3(hs, m, k));
const gaussOf = (hs, m, k) => Math.sqrt(-2 * Math.log(Math.max(1e-12, uni(hs, m, k)))) * Math.cos(2 * Math.PI * uni(hs, m, k + 4096));
// role name -> role id (the second parent is a 'parent', a grown child who is a grandchild's parent a 'child')
const ROLE_ID = Object.fromEntries(ROLE_NAMES.map((r, i) => [r, i === R_PARENT2 ? R_PARENT : i === R_GPAR ? R_CHILD : i]));
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

/** An adult child of the householder married to a relative living here (a son- or daughter-in-law), or null. */
function childSpousePair(mem) {
  for (let i = 0; i < mem.length; i++) {
    if (mem[i].role !== 'child' || mem[i].age < 20) continue;
    const j = mem.findIndex((q, k) => k !== i && q.role === 'relative' && q.sex !== mem[i].sex && q.age >= 20 && Math.abs(q.age - mem[i].age) <= 8);
    if (j >= 0) return [i, j];
  }
  return null;
}

/**
 * The parent of each grandchild: one of the householder's children living here whom the parent-age rule allows
 * (layer 0 makes sure there is one), the same one for every grandchild when one fits them all (siblings), else the
 * one nearest a typical age at a birth. -1 for members who are not grandchildren.
 * @param {Array<{role: string, sex: string, age: number}>} mem
 * @returns {Int8Array}
 */
function pickGrandParents(mem) {
  const n = mem.length, gp = new Int8Array(n).fill(-1), gcs = [], kids = [];
  for (let i = 1; i < n; i++) { if (mem[i].role === 'grandchild') gcs.push(i); else if (mem[i].role === 'child') kids.push(i); }
  if (!gcs.length) return gp;
  const fits = (c, g) => parentGapOk(mem[c].age, mem[c].sex === 'F', mem[g].age);
  const cost = (c, list) => { let s = 0; for (const g of list) s += Math.abs(mem[c].age - mem[g].age - (mem[c].sex === 'F' ? 28 : 31)); return s; };
  const best = (cands, list) => { let b = -1, bc = Infinity; for (const c of cands) { const v = cost(c, list); if (v < bc) { bc = v; b = c; } } return b; };
  const common = kids.filter(c => gcs.every(g => fits(c, g)));
  if (common.length) { const c = best(common, gcs); for (const g of gcs) gp[g] = c; return gp; }
  for (const g of gcs) gp[g] = best(kids.filter(c => fits(c, g)), [g]);
  return gp;
}

/**
 * Who in a household is whose parent, from roles, ages and heritages (no draw). The householder's children are the
 * householder's and the spouse's or partner's when old enough (14 or more years older: a stepparent barely older
 * than the child is not counted). The members in the 'parent' and 'sibling' roles are the householder's, or the
 * spouse's (partner's) when they carry the spouse's heritage and not the householder's (parents- and siblings-in-law,
 * as layer 0 draws them): the householder's parents are the householder's own, the spouse's parents the in-laws, and
 * a brother or sister is the child of the parents on their side when the ages allow it (kinGapOk). A grandchild's
 * parent is the householder's child layer 0 drew it with (pickGrandParents), with that child's spouse when they live
 * here too.
 * @param {Array<{role: string, sex: string, age: number, heritage: string}>} mem
 * @returns {{p1: Int8Array, p2: Int8Array, inlaw: Int8Array, gp: Int8Array, side: Int8Array, sp: number}} p1: the parent
 *   whose whereabouts at the birth decide where it was (the mother when she lives here), p2: the other parent living
 *   here, -1 for none; inlaw: an adult child and the relative married to them point at each other, else -1; gp:
 *   pickGrandParents; side: for parents and siblings, whose they are (0 the householder's, else the spouse's index),
 *   -1 for the others; sp: the spouse or partner, or -1
 */
function kinship(mem) {
  const n = mem.length, p1 = new Int8Array(n).fill(-1), p2 = new Int8Array(n).fill(-1), inlaw = new Int8Array(n).fill(-1), side = new Int8Array(n).fill(-1);
  const pair = childSpousePair(mem);
  if (pair) { inlaw[pair[0]] = pair[1]; inlaw[pair[1]] = pair[0]; }
  const set = (i, a, b) => {
    if (a < 0) { a = b; b = -1; }
    if (b >= 0 && mem[a].sex !== 'F' && mem[b].sex === 'F') { const t = a; a = b; b = t; }
    p1[i] = a; p2[i] = b;
  };
  const sp = mem.findIndex(p => p.role === 'spouse' || p.role === 'partner');
  const H = mem[0].heritage, S = sp > 0 ? mem[sp].heritage : null;
  const mom = [-1, -1], dad = [-1, -1];   // the householder's, the spouse's
  for (let j = 1; j < n; j++) {
    const role = mem[j].role;
    if (role !== 'parent' && role !== 'sibling') continue;
    const s = S !== null && S !== H && mem[j].heritage === S ? 1 : 0;
    side[j] = s ? sp : 0;
    if (role === 'parent') { if (mem[j].sex === 'F') { if (mom[s] < 0) mom[s] = j; } else if (dad[s] < 0) dad[s] = j; }
  }
  const fits = (q, i) => (q >= 0 && kinGapOk(mem[q].age, mem[q].sex === 'F', mem[i].age) ? q : -1);
  // the householder or the spouse is a child's parent from 14 years older; a woman no more than 50 years older (else a
  // stepmother: the wife of a father much older than her)
  const parentOf = (q, i) => { const d = mem[q].age - mem[i].age; return d >= 14 && (mem[q].sex !== 'F' || d <= 50); };
  const gp = pickGrandParents(mem);
  for (let i = 0; i < n; i++) {
    const role = mem[i].role, age = mem[i].age;
    if (role === 'child') set(i, parentOf(0, i) ? 0 : -1, sp > 0 && parentOf(sp, i) ? sp : -1);
    else if (i === 0) set(0, mom[0], dad[0]);
    else if (i === sp) set(i, fits(mom[1], i), fits(dad[1], i));
    else if (role === 'sibling') { const s = side[i] ? 1 : 0; set(i, fits(mom[s], i), fits(dad[s], i)); }
    else if (role === 'grandchild' && gp[i] >= 0) { const s = inlaw[gp[i]]; set(i, gp[i], s >= 0 && mem[s].age >= age + 14 ? s : -1); }
  }
  return { p1, p2, inlaw, gp, side, sp };
}

/** Nativity inputs that do not depend on the calibrated shift (latent uniforms, offsets, caps, who derives from whom). */
function natPrep(core, ori, hs, kin) {
  const mem = core.members, n = mem.length, zH = gaussOf(hs, 99, KA.NATH);
  const P = { n, kin, ori, role: new Uint8Array(n), age: new Uint8Array(n), fem: new Uint8Array(n), anchor: new Int8Array(n), by: new Int16Array(n), since: new Int16Array(n), force: new Uint8Array(n), U: new Float64Array(n), off: new Float64Array(n), arrY: new Int16Array(n), arrT: new Int16Array(n), arrU: new Float64Array(n), genU: new Float64Array(n), terr: new Uint8Array(n), fb: new Float64Array(n), g2: new Float64Array(n), childList: [], grandList: [] };
  const g0 = H_GROUP[H_INDEX[ORIGINS[ori[0]].heritage]];
  for (let i = 0; i < n; i++) {
    const p = mem[i], role = ROLE_ID[p.role], o = ORIGINS[ori[i]];
    P.role[i] = role; P.age[i] = p.age; P.fem[i] = p.sex === 'F' ? 1 : 0;
    // whose generation a parent or sibling belongs to: the householder's, or the spouse's for in-laws
    P.anchor[i] = kin.side[i] > 0 ? kin.side[i] : 0;
    P.by[i] = YEAR - p.age - (uni(hs, i, KA.BDAY) < 0.11 ? 1 : 0);
    P.since[i] = o.since;
    const same = H_GROUP[H_INDEX[o.heritage]] === g0;
    const rho = i === 0 ? 1 : same && role !== R_ROOM && role !== R_CHILD && role !== R_GRAND ? 0.7 : 0;
    P.U[i] = normCdf(rho * zH + Math.sqrt(1 - rho * rho) * gaussOf(hs, i, KA.NAT));
    P.off[i] = o.beta + natAge(p.age);
    const au = uni(hs, i, KA.ARR);
    P.arrY[i] = arrivalYearOf(p.age, au, o.since); P.arrT[i] = arrivalYearOf(p.age, au, 1945);
    P.arrU[i] = uni(hs, i, KA.ARR2);
    P.genU[i] = uni(hs, i, KA.GEN);
    P.terr[i] = o.territory > 0 && p.age >= 18 && uni(hs, i, KA.TERR) < o.territory * (p.age >= 25 ? 1 : 0.5) ? 1 : 0;
    // born before the origin's US community began (the Hmong after 1975, Ethiopians after 1979 ...): not born in the
    // 50 states, so foreign born (1), or born in a territory (2) where the origin's people were born there
    if (P.by[i] < o.since) P.force[i] = o.territory > 0 && (P.terr[i] || !o.places.length) ? 2 : o.places.length ? 1 : 0;
    P.fb[i] = o.fb;
    P.g2[i] = Math.min(0.9, o.fb * 1.3 * (p.age < 18 ? 1.3 : p.age < 45 ? 1.15 : p.age < 65 ? 0.9 : 0.55));
  }
  for (let i = 0; i < n; i++) if (P.role[i] === R_CHILD) P.childList.push(i); else if (P.role[i] === R_GRAND) P.grandList.push(i);
  return P;
}

/**
 * A parent's move here, set back to a year at or before `year` (they came before their child was born here), drawn
 * from the parent's own uniform; false (nothing changed) when they were born after it or their origin's community
 * began after it (a stepparent who came later).
 */
function arriveBy(P, R, j, year) {
  const lo = Math.max(P.by[j], R.nat[j] ? P.since[j] : 0);
  if (lo > year) return false;
  R.arr[j] = Math.max(lo, year - Math.floor(P.arrU[j] * Math.min(6, year - lo + 1)));
  return true;
}

/**
 * The generation that lives with a mother in the 'parent' role (the householder and siblings, or for a mother-in-law
 * the spouse and the spouse's siblings) was born where she was: a child born outside the 50 states before she came
 * (her arrival moves after the latest such birth: to the arrival of a child who came young with her, else near the
 * first child's), one born here after she came (her arrival moves back before the earliest such birth). The first of
 * her children here (the householder, the spouse) holds when the dates disagree (a family that went back and forth):
 * a brother or sister born on the other side of her arrival is born where the dates put them, abroad with her or here
 * (a sister forced abroad by her community's start is a half-sister instead: not listed as her child). One whose own
 * birth rules her out is not listed as her child either. Children who came as small children before her came with her.
 * @returns {Int16Array} the earliest arrival each such mother could have (0 for other members)
 */
function motherLines(P, R) {
  const { nat, out, arr, gen, from, step } = R, by = P.by, kin = P.kin, n = P.n, low = new Int16Array(n);
  for (let j = 1; j < n; j++) {
    if (P.role[j] !== R_PARENT || !P.fem[j] || !out[j]) continue;
    const kids = [];
    for (let i = 0; i < n; i++) if (kin.p1[i] === j && P.role[i] !== R_CHILD && P.role[i] !== R_GRAND) kids.push(i);
    if (!kids.length) continue;
    let lo = Math.max(by[j], nat[j] ? P.since[j] : 0), hi = YEAR;
    const flipped = [];
    for (let k = 0; k < kids.length; k++) {
      const i = kids[k], a = out[i] ? by[i] + 1 : lo, b = out[i] ? hi : by[i];
      if (Math.max(lo, a) <= Math.min(hi, b)) { lo = Math.max(lo, a); hi = Math.min(hi, b); continue; }
      if (k === 0 || (out[i] && P.force[i])) { step[i] = j; continue; }
      if (out[i]) { nat[i] = 0; out[i] = 0; arr[i] = 0; from[i] = -1; hi = Math.min(hi, by[i]); }   // born here, after she came
      else { nat[i] = nat[j]; out[i] = 1; gen[i] = nat[j] ? 1 : 3; flipped.push(i); }           // born abroad, came with her
    }
    low[j] = lo;
    if (arr[j] > hi) arr[j] = Math.max(lo, hi - Math.floor(P.arrU[j] * Math.min(6, hi - lo + 1)));
    else if (arr[j] < lo) {
      // she came after her children born abroad: with one who came young, else around when the first of them came
      let young = -1, first = 0;
      for (const i of kids) {
        if (!out[i] || step[i] === j || !arr[i]) continue;
        if (arr[i] >= lo && arr[i] <= hi && arr[i] - by[i] < 18 && (young < 0 || arr[i] < arr[young])) young = i;
        if (!first || arr[i] < first) first = arr[i];
      }
      arr[j] = young >= 0 ? arr[young] : clamp((first || lo) - 3 + Math.floor(P.arrU[j] * 14), lo, hi);
    }
    // children born abroad who came as small children before her came with her (or she with the first of them)
    let small = 0;
    for (const i of kids) if (out[i] && step[i] !== j && arr[i] && arr[i] < arr[j] && arr[i] - by[i] < 13 && (!small || arr[i] < small)) small = arr[i];
    if (small >= lo) arr[j] = small;
    for (const i of kids) {
      if (!out[i] || step[i] === j) continue;
      if (!arr[i] || (arr[i] < arr[j] && arr[i] - by[i] < 13)) arr[i] = arr[j];
      if (arr[i] === arr[j] && arr[i] - by[i] < 18) from[i] = j;
    }
    for (const i of flipped) { arr[i] = arr[j]; from[i] = j; }
  }
  return low;
}

/**
 * Nativity for a household at shift alpha: nat 1 = foreign born; out 1 = born outside the 50 states (abroad, or in a
 * territory: Puerto Rico, Guam, American Samoa, whose people are native-born citizens or nationals); arrival = year
 * of arrival (or of the move to the mainland); gen 1 (an immigrant), 2 (a child of an immigrant), 3 (third or more,
 * which includes everyone born in a territory); from = the parent someone born abroad came here with; step = a parent
 * listed by kinship who is not the person's parent by the dates (a stepparent).
 *
 * Adults are drawn at the calibrated shift, except that nobody is born in the 50 states before their origin's US
 * community began; parents and siblings follow the nativity of the householder (or, for in-laws, the spouse) they
 * live with. Each person is born where their mother (else the parent living here) was at the birth (motherLines for
 * the householder's generation). A child (or grandchild) born before she moved here was born abroad, where she was
 * born, and came with her; a husband or partner here who was born a citizen, or is of another origin, is then the
 * child's stepfather (a citizen's child would be a citizen by birth; parents of two origins met here). Born after,
 * they are born here, second generation when a parent living here is an immigrant, and a parent living here who
 * arrived only after that birth had in fact come before it (their arrival moves back). The same holds for the adults
 * born here and the parents they live with.
 */
function natDecide(P, alpha, R) {
  const n = P.n, nat = R.nat, out = R.out, arr = R.arr, gen = R.gen, from = R.from, step = R.step, by = P.by, kin = P.kin;
  nat.fill(0); out.fill(0); arr.fill(0); gen.fill(3); from.fill(-1); step.fill(-1);
  // a parent here born outside the 50 states who arrived after person i's birth here came before it (their arrival
  // moves back); one who could not have (born later, or their community began later) is a stepparent
  const cameBefore = (i, j) => !(out[j] && arr[j] > by[i]) || arriveBy(P, R, j, by[i]) || ((step[i] = j), false);
  for (let i = 0; i < n; i++) {
    const role = P.role[i];
    if (role === R_CHILD || role === R_GRAND) continue;
    if (P.force[i] === 1) { nat[i] = 1; out[i] = 1; arr[i] = P.arrY[i]; gen[i] = 1; continue; }
    if (P.force[i] === 2) { out[i] = 1; arr[i] = P.arrT[i]; continue; }
    let p = 1 / (1 + Math.exp(-(alpha + P.off[i])));
    if (i > 0 && (role === R_PARENT || role === R_SIB) && nat[P.anchor[i]]) p = 1 - (1 - p) * 0.1;
    if (P.U[i] < p) { nat[i] = 1; out[i] = 1; arr[i] = P.arrY[i]; gen[i] = 1; }
    else if (P.terr[i]) { out[i] = 1; arr[i] = P.arrT[i]; }
  }
  const low = motherLines(P, R);
  const settle = i => {
    let a = kin.p1[i], b = kin.p2[i];
    // a grandchild's parent who is the householder's child stays their parent: when the other parent (a son's wife)
    // came only after the birth, and a child born abroad with her could not be his, she had come before it (else she
    // is not the grandchild's mother, and the grandchild was born where the householder's child was)
    if (P.role[i] === R_GRAND && b >= 0 && b === kin.gp[i] && out[a] && by[i] < arr[a] && (!nat[b] || P.ori[b] !== P.ori[a]) && !arriveBy(P, R, a, by[i])) {
      step[i] = a; a = b; b = -1;
    }
    if (a >= 0 && out[a] && by[i] < arr[a]) {
      out[i] = 1; nat[i] = nat[a]; arr[i] = arr[a]; gen[i] = nat[a] ? 1 : 3; from[i] = a;
      if (b >= 0 && nat[i] && (!nat[b] || P.ori[b] !== P.ori[a])) step[i] = b;
      return;
    }
    if (P.force[i]) {
      // born before the origin's community began, yet not along with the birth parent: with the other parent when
      // they came later, else on their own
      if (P.force[i] === 2) { out[i] = 1; arr[i] = P.arrT[i]; return; }
      nat[i] = 1; out[i] = 1; gen[i] = 1;
      if (b >= 0 && nat[b] && by[i] < arr[b]) { arr[i] = arr[b]; from[i] = b; } else arr[i] = P.arrY[i];
      return;
    }
    let imm = 0;
    for (const j of [a, b]) if (j >= 0 && cameBefore(i, j) && nat[j]) imm = 1;
    gen[i] = a < 0 ? (P.genU[i] < Math.min(0.9, P.fb[i] * 1.3) ? 2 : 3) : imm ? 2 : 3;
  };
  for (let k = 0; k < P.childList.length; k++) settle(P.childList[k]);
  for (let k = 0; k < P.grandList.length; k++) settle(P.grandList[k]);
  // a householder or spouse whose arrival moved back before a child's birth here, to before their own mother came
  // and while they were small: she came with them
  for (const i of [0, kin.sp]) {
    const j = i >= 0 ? kin.p1[i] : -1;
    if (j >= 0 && low[j] && step[i] !== j && out[i] && out[j] && arr[i] < arr[j] && arr[i] - by[i] < 13 && arr[i] >= low[j]) arr[j] = arr[i];
  }
  // adults born here: second generation when a parent living here is an immigrant (who then came before the birth),
  // else by their origin's immigrant share and age
  for (let i = 0; i < n; i++) {
    const role = P.role[i];
    if (out[i] || role === R_CHILD || role === R_GRAND) continue;
    let g2 = P.g2[i];
    for (const j of [kin.p1[i], kin.p2[i]]) if (j >= 0 && step[i] !== j && cameBefore(i, j) && nat[j]) g2 = 1;
    gen[i] = P.genU[i] < g2 ? 2 : 3;
  }
  return R;
}
const natResult = n => ({ nat: new Uint8Array(n), out: new Uint8Array(n), arr: new Int16Array(n), gen: new Uint8Array(n), from: new Int8Array(n), step: new Int8Array(n) });

/** Kinship without the stepparents nativity found (natDecide's step): the parents a layer-1 record lists. */
function withoutSteps(kin, N) {
  const p1 = Int8Array.from(kin.p1), p2 = Int8Array.from(kin.p2);
  for (let i = 0; i < p1.length; i++) {
    const s = N.step[i];
    if (s < 0) continue;
    if (p2[i] === s) p2[i] = -1;
    else if (p1[i] === s) { p1[i] = p2[i]; p2[i] = -1; }
  }
  return { p1, p2, inlaw: kin.inlaw, gp: kin.gp, side: kin.side, sp: kin.sp };
}

// education classes: 0-24 occupation groups, 25 armed forces, 26-28 not working at 25-44, 45-64, 65+
const OCC_INDEX = Object.fromEntries(OCC_GROUPS.map((g, i) => [g, i]));
const EDU_PRIOR = [
  [4, 14, 16, 8, 36, 17, 3, 2], [2, 9, 14, 8, 46, 18, 2, 1], [1, 5, 10, 8, 48, 24, 1, 3], [1, 6, 11, 10, 45, 21, 2, 4],
  [1, 4, 7, 6, 34, 26, 4, 18], [2, 9, 14, 7, 38, 26, 2, 2], [1, 6, 12, 8, 20, 5, 47, 1], [2, 7, 10, 6, 38, 30, 2, 5],
  [3, 12, 17, 8, 43, 13, 2, 2], [1, 3, 5, 20, 33, 14, 18, 6], [3, 17, 29, 25, 20, 5, 0.5, 0.5], [12, 33, 30, 11, 11, 2, 0.08, 0.08],
  [7, 33, 30, 11, 15, 3, 0.08, 0.08], [2, 18, 31, 15, 27, 6, 0.5, 0.5], [25, 38, 20, 6, 9, 1.5, 0.08, 0.08], [40, 33, 14, 5, 6, 1.5, 0.08, 0.08],
  [15, 30, 25, 10, 16, 3.5, 0.08, 0.08], [8, 30, 22, 8, 26, 5, 0.5, 0.5], [6, 30, 26, 11, 22, 4, 0.5, 0.5], [62, 22, 8, 3, 4, 0.8, 0.08, 0.08],
  [38, 35, 15, 5, 6, 1, 0.08, 0.08], [15, 40, 22, 11, 10, 1.5, 0.08, 0.08], [30, 38, 16, 7, 7, 1.5, 0.08, 0.08], [20, 42, 20, 7, 9, 1.5, 0.08, 0.08],
  [30, 40, 17, 5, 7, 1, 0.08, 0.08], [2, 30, 30, 12, 20, 5, 0.5, 0.5], [22, 30, 18, 7, 15, 5, 1.5, 1.5], [25, 30, 18, 7, 13, 5, 1, 1],
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
/** The most schooling finished by an age (an index into EDUCATION_KEYS). */
const eduCapAge = a => a < 18 ? 0 : a < 19 ? 1 : a < 21 ? 2 : a < 22 ? 3 : a < 24 ? 4 : a < 25 ? 5 : 7;
/**
 * The range [lo, hi] of education levels possible for a member: no more than their age allows, a bachelor's for a
 * graduate student, no more than a bachelor's for an undergraduate, and a job title's own requirement (always for
 * a licensed title, whose degree is never missing; within what the age allows for the others).
 */
function eduBounds(p, title) {
  let lo = 0, hi = eduCapAge(p.age);
  if (p.student === 'grad') { lo = 4; if (hi < 4) hi = 4; } else if (p.student === 'college' && hi > 4) hi = 4;
  if (title) { if (title.licensed) lo = Math.max(lo, title.edu); else lo = Math.max(lo, Math.min(title.edu, hi)); }
  if (hi < lo) hi = lo;
  return [lo, hi];
}
/**
 * Education index per member (-1 a child under 18 not in school, -2 in school under 25), drawn within eduBounds
 * from the ZIP's calibrated row for the member's class; titles (per member, or null) come first.
 */
function eduDecide(core, hs, rows, titles) {
  const mem = core.members, out = new Int8Array(mem.length);
  for (let i = 0; i < mem.length; i++) {
    const p = mem[i], u = uni(hs, i, KA.EDU), title = titles && titles[i] ? titles[i].t : null;
    if (p.age < 18) out[i] = p.student ? -2 : -1;
    else if (p.age < 25 && p.student && !(title && title.licensed)) out[i] = -2;
    else { const [lo, hi] = eduBounds(p, title); out[i] = drawRow(p.age < 25 ? EDU_YOUNG : rows[eduClass(p)], lo, hi, u); }
  }
  return out;
}

/**
 * Weekly hours a worker is paid for, as their record shows them (occupation.hours): their work days times hours at
 * work (a student's after-school job: 12), in whole hours.
 */
const weeklyHours = p => Math.max(1, Math.round(p.student === 'k12' ? 12 : popcount(p.workDays || p.days || 62) * Math.min(p.dwellMin || 480, 720) / 60));
/** Hours a week counted at the straight rate: those over 40 count time and a half (California and federal overtime). */
const paidHours = h => Math.min(h, 40) + 1.5 * Math.max(0, h - 40);
/**
 * The least a worker may be paid for `hours` a week over `weeks` weeks, in whole hundreds (rounded up): California's
 * minimum wage with overtime for a civilian; federal basic pay for a service member (MIL_PAY_FLOOR a year, whatever
 * the hours: the state minimum wage does not apply to them).
 */
const minPayFor = (p, hours, weeks) => Math.ceil((p.military ? MIL_PAY_FLOOR * weeks / 52 : MIN_WAGE_HOURLY * paidHours(hours) * weeks) / 100) * 100;
// The fewest weeks a worker who has a job now worked in the past twelve months (B19001 counts that year's income: a
// job begun a few weeks ago, seasonal work); a service member under 25 may have enlisted during the year, an older
// one served all of it
const MIN_WEEKS = 6;
const minWeeksOf = p => (p.military ? (p.age < 25 ? 26 : 52) : MIN_WEEKS);
const eduLevel = e => e >= 0 ? e : e === -2 ? 2 : 1;   // numeric level for language and wages

/**
 * Limited English by age at arrival, as [log-odds, share of the ZIP's level]: those who came as small children went
 * to school here and are fluent much like the US born (a small share of the level, like US-born teenagers); those who
 * came as teenagers less so; from 18 on, the later they came, the harder the language.
 */
const arrivalOdds = A => A < 13 ? [-3.4 + 0.15 * A, 0.4] : A < 18 ? [-1.6 + 0.32 * (A - 13), 0.8] : [0.035 * Math.min(A - 18, 32), 1];
// how many synthetic speakers of a language bucket weigh as much as the ZIP's pooled level (a bucket few of the
// synthetic households speak keeps near the ZIP's level rather than running to an extreme to fit a handful of people)
const LEP_PRIOR_N = 30;

/**
 * Language inputs that do not depend on the calibrated bucket scales. Limited English (C16001: speaking English less
 * than very well) for someone who speaks another language at home is log-odds x + k * delta, delta being the ZIP's
 * calibrated level for the language's bucket: an immigrant who came as an adult carries the level in full (one who
 * came as a teenager four fifths of it, one who came as a small child two fifths from a much lower start: arrivalOdds),
 * more the older they came and the more recently, less with schooling; so do US-born children of 5 to 12 in homes
 * where it is spoken, from a much lower start that falls with every school year (kindergartners of immigrants are
 * still learning English, most ten-year-olds are fluent); US-born teenagers about a third of it from lower still;
 * US-born adults, almost all fluent, about a seventh of it from a low start, so that a ZIP whose C16001 count outruns
 * its immigrants puts the rest mostly on its youngest children rather than on teenagers and adults raised here.
 * Each bucket's level is shrunk toward the ZIP's pooled level by its synthetic speakers (LEP_PRIOR_N), so a bucket
 * that only a few households speak does not run to an extreme.
 * k = 0: never (a heritage with no immigrants, such as Native Hawaiians and the US tribes).
 * @param {number[]|Int16Array} by birth years (natPrep)
 */
function langPrep(core, ori, N, edu, hs, F, by) {
  const mem = core.members, n = mem.length, zL = gaussOf(hs, 98, KA.LANGH);
  const L = { n, age: new Uint8Array(n), role: new Uint8Array(n), U: new Float64Array(n), cross: new Float64Array(n), span: new Float64Array(n), base: new Float64Array(n), x: new Float64Array(n), k: new Float64Array(n), choiceOf: new Int8Array(n).fill(-1), choices: [], spouse: -1 };
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
  // a child born abroad who came here with a parent of another origin grew up in that parent's language (and is named
  // in it: _names), not in the language of the heritage layer 0 gave them from their other parent
  const src = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const c = N.nat[i] ? N.from[i] : -1;
    src[i] = c >= 0 && ori[c] !== ori[i] && L.choiceOf[c] >= 0 ? c : i;
    if (src[i] !== i) L.choiceOf[i] = L.choiceOf[c];
  }
  for (let i = 1; i < n; i++) if (mem[i].role === 'spouse' || mem[i].role === 'partner') { L.spouse = i; break; }
  const outParent = N.out[0] || (L.spouse >= 0 && N.out[L.spouse]);
  for (let i = 0; i < n; i++) {
    const p = mem[i], o = ORIGINS[ori[i]];
    L.age[i] = p.age; L.role[i] = ROLE_ID[p.role];
    L.U[i] = normCdf(0.6 * zL + 0.8 * gaussOf(hs, i, KA.LANG));
    L.cross[i] = uni(hs, i, KA.CROSS); L.span[i] = uni(hs, i, KA.SPAN);
    // the generation that sets the home language and English: born in a territory, Puerto Ricans grew up in Spanish
    // (like immigrants) while Guam and American Samoa are bilingual (like the second generation); the mainland-born
    // children living with them are like the second generation
    const terr = N.out[i] && !N.nat[i], withParent = p.role === 'grandchild' || (p.role === 'child' && outParent);
    let g = N.gen[i];
    if (terr) g = o.terrNative ? 2 : 1;
    else if (g === 3 && withParent) g = 2;
    const ol = ORIGINS[ori[src[i]]];
    if (L.choiceOf[i] >= 0) L.base[i] = terr ? o.terrLang * o.use : g === 1 ? (p.age >= 18 ? 0.93 : 0.85) * ol.use : g === 2 ? (withParent ? 0.66 : 0.42) * ol.use : ol.retain;
    // limited English: immigrants (and the Puerto Rico born, who grew up in Spanish) by age at arrival, years here,
    // schooling and age; the US born by age and generation
    const e = eduLevel(edu[i]);
    let x, k;
    if (!o.fb && !o.territory) { x = -40; k = 0; }
    else if (N.nat[i] || (terr && !o.terrNative)) {
      const A = clamp(N.arr[i] - by[i], 0, p.age), Y = Math.max(0, YEAR - N.arr[i]), [ax, ak] = arrivalOdds(A);
      x = 1 + ax - 0.05 * Math.min(Y, 30) + (Y < 3 ? 0.8 : 0) - 0.25 * Math.max(0, e - 1) + (p.age >= 65 ? 0.5 : 0);
      k = ak;
    } else if (p.age < 13) { x = g === 2 ? -2.2 - 0.3 * Math.max(0, p.age - 5) : -4.2 - 0.1 * Math.max(0, p.age - 5); k = 1; }
    else if (p.age < 18) { x = g === 2 ? -3.6 : -4.6; k = 0.35; }
    else { x = (g === 2 ? -2.9 : -3.6) - 0.2 * Math.max(0, e - 1) + (p.age >= 65 ? 0.6 : 0); k = 0.15; }
    L.x[i] = x; L.k[i] = k;
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
  const pair = childSpousePair(mem);
  if (pair) { out[pair[0]] = 1; out[pair[1]] = 1; }
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

// Veterans (B21001 by sex and age band). Nobody is a veteran before serving a term, so within the 18-34 band the
// rate rises from 0 at 19 to the full rate at 25, scaled so the band's own rate still comes back.
const VET_RAMP = a => clamp((a - 19) / 6, 0, 1);
// B21001's age band of each B01001 bracket (-1 under 18): 18-34, 35-54, 55-64, 65-74, 75+
const VET_BAND_OF = Int8Array.from(AGE_LO, lo => (lo < 18 ? -1 : lo < 35 ? 0 : lo < 55 ? 1 : lo < 65 ? 2 : lo < 75 ? 3 : 4));
const VET_RAMP_MEAN = (() => { let s = 0; for (let a = 18; a <= 34; a++) s += VET_RAMP(a); return s / 17; })();
/** The chance a member is a veteran, from the ZIP's B21001 rate for their sex and age band. */
function vetRateAt(F, p) {
  if (p.age < 18) return 0;
  const b = p.age < 35 ? 0 : p.age < 55 ? 1 : p.age < 65 ? 2 : p.age < 75 ? 3 : 4, rate = F.vetRate[(p.sex === 'F' ? 5 : 0) + b];
  return b ? rate : Math.min(1, rate * VET_RAMP(p.age) / VET_RAMP_MEAN);
}

/** 'Honduran American' + 'Vietnamese American' -> 'Honduran and Vietnamese American' (a label not of that form: the first). */
const mixedLabel = (a, b) => {
  const am = / American$/.exec(a), bm = / American$/.exec(b);
  if (!am || !bm || a === b) return a;
  return `${a.slice(0, am.index)} and ${b.slice(0, bm.index)} American`;
};

const SYN_N = 700, SYN_BASE = 0x3f000000;   // synthetic calibration households live past every real household index
const EDUCATION_KEYS = ['nohs', 'hs', 'somecollege', 'associate', 'bachelor', 'master', 'professional', 'doctorate'];

/** A household's earning-power score (log dollars plus household luck): the ranking behind B19001. */
const incomeScore = (pot, hs, floor = 0) => Math.max(Math.log(2000 + sum(pot)) + 0.35 * gaussOf(hs, 97, KA.INC), Math.log(2000 + floor));

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
/** A worker's pay floor: the minimum wage for their hours and weeks, and 45% of their job's usual pay for those weeks. */
const payFloor = (J, i) => J.occ[i] ? Math.max(J.minPay[i], 0.45 * J.pot[i]) : 0;
/** The least a household earns given its workers' pay floors. */
const incomeFloor = J => { let f = 0; for (let i = 0; i < J.pot.length; i++) f += payFloor(J, i); return f; };
/** The least a household earns when each worker worked the fewest weeks their record allows (partYear). */
const incomeFloorMin = J => {
  let f = 0;
  for (let i = 0; i < J.pot.length; i++) {
    const o = J.occ[i];
    if (!o) continue;
    const p = J.mem[i], wk = minWeeksOf(p);
    f += Math.max(minPayFor(p, o.hours, wk), 0.45 * J.pot[i] * wk / 52);
  }
  return f;
};
/**
 * The weeks each worker of a household worked in the past twelve months. A household whose rank in the ZIP (B19001)
 * gives it less than its workers' full-year pay floors add up to worked part of the year (seasonal work, a job begun
 * during the year: B19001 wins over a year of full-time pay): every worker's weeks shrink in proportion, in whole weeks
 * and never below minWeeksOf, and their earning power and pay floors with them. Mutates J (occupation.weeks, pot, minPay).
 * @param {{occ: Array, pot: Float64Array, minPay: Float64Array, mem: Array}} J _jobs
 * @param {number} Y the household's income
 */
function partYear(J, Y) {
  const full = incomeFloor(J);
  if (!(Y < full)) return;
  const f = Y / full;
  for (let i = 0; i < J.occ.length; i++) {
    const o = J.occ[i];
    if (!o) continue;
    const p = J.mem[i], wk = clamp(Math.floor(52 * f), minWeeksOf(p), 52);
    if (wk >= 52) continue;
    o.weeks = wk;
    J.pot[i] *= wk / 52;
    J.minPay[i] = minPayFor(p, o.hours, wk);
  }
}
/**
 * Each member's part of a household income Y (at least incomeFloor(J)): workers near their job's usual pay and
 * others by their earning power, scaled together toward Y but never below a pay floor, so the parts add up to Y
 * exactly or fall short of it (the rest is the householder's other income: savings, rent, help).
 */
function allocateIncome(J, Y) {
  const pot = J.pot, n = pot.length, inc = new Float64Array(n), floor = new Float64Array(n);
  let total = 0; for (let i = 0; i < n; i++) total += pot[i];
  const s = total > 0 ? Y / total : 0;
  for (let i = 0; i < n; i++) { floor[i] = payFloor(J, i); inc[i] = Math.max(floor[i], pot[i] * (J.occ[i] ? clamp(s, 0.7, 1.35) : clamp(s, 0.5, 2))); }
  let sumInc = 0, free = 0;
  for (let i = 0; i < n; i++) { sumInc += inc[i]; free += inc[i] - floor[i]; }
  if (sumInc > Y && free > 0) { const g = Math.max(0, 1 - (sumInc - Y) / free); for (let i = 0; i < n; i++) inc[i] = floor[i] + (inc[i] - floor[i]) * g; }
  return inc;
}

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

/**
 * A place name drawn by weight, preferring places tagged with a language, optionally reweighted by name; with a
 * birth year, only places that existed that year (a refugee camp's years). Null when none of them did.
 */
function pickPlace(places, u, lang, boost, year) {
  let t = 0;
  // a place tagged with other languages only when none is tagged with the family's (a Portuguese-speaking family from
  // São Paulo, never Mexico City)
  const other = lang && places.some(pl => pl.tags.includes(lang)) ? 0 : 0.05;
  const wt = pl => (year !== undefined && pl.from && (year < pl.from || year > pl.to) ? 0 : 1) * pl.w
    * (!lang || !pl.tags.length ? 1 : pl.tags.includes(lang) ? 4 : other) * (boost && boost[pl.name] ? boost[pl.name] : 1);
  for (const pl of places) t += wt(pl);
  if (!(t > 0)) return null;
  let x = u * t;
  for (const pl of places) { x -= wt(pl); if (x < 0) return pl.name; }
  for (let k = places.length - 1; k >= 0; k--) if (wt(places[k]) > 0) return places[k].name;
  return null;
}
/** A birthplace from the first of the lists with a place that existed in the year (the whole first list if none did). */
function pickBirthplace(lists, u, lang, year) {
  for (const l of lists) if (l && l.length) { const v = pickPlace(l, u, lang, null, year); if (v !== null) return v; }
  const l = lists.find(x => x && x.length);
  return l ? pickPlace(l, u, lang) : null;
}
// The years a birthplace existed, by name (places with no window are absent), and whether one existed in a year.
const PLACE_YEARS = new Map();
for (const o of ORIGINS) for (const pl of [...o.places, ...o.territoryPlaces]) if (pl.from) PLACE_YEARS.set(pl.name, [pl.from, pl.to]);
/** True when someone could be born at the named place in the year (always, for a place with no window). */
const placeExisted = (name, year) => { const w = PLACE_YEARS.get(name); return !w || (year >= w[0] && year <= w[1]); };
// The country (or Mexican state, US territory ...) of a birthplace: the last part of 'City, Region'.
const regionOf = name => { const i = name.lastIndexOf(', '); return i < 0 ? name : name.slice(i + 2); };
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
   * @param {{seed?: number, cache?: number}} [options] cache: how many layer-1 households to keep (default 2048; four
   *   times as many people)
   */
  constructor(world, { seed = LEGION_SEED, cache = 2048 } = {}) {
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

  /**
   * Expected household population of ZIP zi: hh x the mean household size its model holds (hhsize; where the pack has
   * none, people per household, or the county's size when group quarters dominate). 0 for a ZIP without households.
   */
  expectedPersons(zi) { const hh = this.householdCount(zi); return hh ? Math.round(hh * this._hhsize(zi)) : 0; }

  /** The mean household size of ZIP zi's model (see expectedPersons). */
  _hhsize(zi) {
    const z = this.world.z, hh = z.hh[zi] || 0;
    let hhsize = z.hhsize[zi];
    if (!(hhsize > 0)) {
      // no published size: people per household, unless group quarters dominate (a base, a campus); then the county's
      const rawPop = sum(this.world.acs(zi, 'age')), cm = this._col(zi, 'hhsize', 2.6);
      hhsize = hh > 0 && rawPop > 0 && rawPop / hh <= 1.3 * cm ? rawPop / hh : cm;
    }
    return clamp(hhsize, 1, 9.5);
  }

  /** The number of people in ZIP zi's households, counted (O(households) once the ZIP's model is built). */
  _personsIn(zi) {
    let n = 0;
    for (let h = 0, H = this.householdCount(zi); h < H; h++) n += this.householdSize(zi, h);
    return n;
  }

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
   * The household population's age-sex pyramid: B01001 (A, scaled to the ZIP's own population) minus an estimate of
   * the group-quarters residents (pop - hh x hhsize, when that is clearly more than rounding). They come first from
   * the adult men who outnumber the women of their age by more than 15%, from 18 to 64 (a prison's inmates, a
   * barracks' soldiers: no household population holds that surplus where group quarters are this many; women only
   * past half again as many as the men, a women's prison), then from the brackets where the ZIP exceeds the shape of
   * its neighbors (a campus's students, a nursing home's elders), the rest across the pyramid.
   */
  _householdPyramid(zi, A, hhPop) {
    const w = this.world, pop = sum(A), G = pop - hhPop, T = Float64Array.from(A);
    let gq = 0;
    if (G > Math.max(25, 0.02 * pop)) {
      const e = new Float64Array(NB2);
      let E = 0;
      for (let b = 4; b <= 16; b++) {   // the brackets from 18-19 to 62-64
        e[b] = Math.max(0, A[b] - 1.15 * A[NB + b]); e[NB + b] = Math.max(0, A[NB + b] - 1.5 * A[b]);
        E += e[b] + e[NB + b];
      }
      const r1 = Math.min(G, E), G2 = G - r1;
      if (r1 > 0) { for (let b = 0; b < NB2; b++) T[b] -= r1 * e[b] / E; gq = G; }
      if (G2 > 0) {
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
          const R = Float64Array.from(T), rest = sum(R), base = pop - G, ex = new Float64Array(NB2);
          let X = 0;
          for (let b = 0; b < NB2; b++) { ex[b] = Math.max(0, R[b] - base * S[b] / st); X += ex[b]; }
          for (let b = 0; b < NB2; b++) T[b] = Math.max(0, R[b] - (X >= G2 ? G2 * ex[b] / X : ex[b] + (G2 - X) * R[b] / rest));
          gq = G;
        }
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
    // Totals come from the ZIP's own counts; the county lends a little shape where the ZIP has few people (the
    // padded pyramid is a shape only, scaled back to the ZIP's population before anything is subtracted from it)
    const rawPop = sum(w.acs(zi, 'age'));
    const shape = this._blk(zi, 'age', 60);
    const hhsize = this._hhsize(zi);
    const hhPop = hh > 0 ? hh * hhsize : Math.max(rawPop, 1);
    const pop = rawPop > 0 ? rawPop : hhPop;
    const st = sum(shape) || 1;
    const A = Float64Array.from(shape, v => v * pop / st);
    const { T, gq } = this._householdPyramid(zi, A, hhPop);
    // the group-quarters residents by age and sex (what the Census person tables count beyond the households)
    const gqAS = Float64Array.from(A, (v, b) => (gq > 0 ? Math.max(0, v - T[b]) : 0));
    const nh = hh > 0 ? hh : hhPop / hhsize;
    const t = Float64Array.from(T, v => v / nh);
    const hht = this._blk(zi, 'hht', 40);
    let typeShare = Float64Array.from(hht, v => v / (sum(hht) || 1));
    if (!(sum(typeShare) > 0)) typeShare = Float64Array.from([0.48, 0.06, 0.12, 0.24, 0.1]);
    // the type mix must allow the mean size: one-person households at least 2 - hhsize of them (all of them in the
    // tiny ZIPs where every household is one person), at most what the largest households leave room for
    const lo = clamp(2 - hhsize, 0, 1), hi = clamp((MAX_FAMILY - hhsize) / (MAX_FAMILY - 1), 0, 1);
    const alone = clamp(typeShare[T_ALONE], lo, hi);
    if (alone !== typeShare[T_ALONE]) {
      const rest = 1 - typeShare[T_ALONE];
      for (let ty = 0; ty < 5; ty++) typeShare[ty] = ty === T_ALONE ? alone : rest > 0 ? typeShare[ty] * (1 - alone) / rest : (1 - alone) / 4;
    }
    const { w: cw, pi: mix } = fitComponents(t, typeShare);
    const M = { zi, hh, hhsize, hhPop, pop, gq, gqAS, A, shape, T, typeShare, cw, mix, comp: new Table(cw), maxSize: 1 };
    // the fitted mix of the child and roommate age kernels, as draw thresholds
    M.piChild = Float64Array.from([mix[RK_CHILD0], mix[RK_CHILD0] + mix[RK_CHILD0 + 1], mix[RK_CHILD0] + mix[RK_CHILD0 + 1] + mix[RK_CHILD0 + 2]]);
    M.piPeer = mix[RK_ROOM0];
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
    M.cw = null; M.A = null; M.shape = null; M.mix = null;   // only needed while building
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
    const hispOfNotG = new Float64Array(NRACE);
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
        if (ro === R_SPOUSE || ro === R_PARTNER) sp += n; else if (ro === R_CHILD || ro === R_GRAND || ro === R_GPAR) kid += n; else if (ro === R_ROOM) room += n; else rel += n;
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
    // single-year populations: all residents (the pyramid padded like B14001 below, so enrollment rates compare
    // like with like in the smallest ZIPs) and the household population (T)
    const popA = new Float64Array(2 * (MAX_AGE + 1)), popT = new Float64Array(2 * (MAX_AGE + 1));
    for (let s = 0; s < 2; s++) for (let a = 0; a <= MAX_AGE; a++) { popA[s * 100 + a] = M.shape[s * NB + BR[a]] * YEAR_SHARE[a]; popT[s * 100 + a] = M.T[s * NB + BR[a]] * YEAR_SHARE[a]; }
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

    // workers (employed civilians + armed forces among 16+, B23025; on a base, those in households: the barracks out)
    const emp = this._hhCensus(zi, M).emp, e16 = sum(emp) || 1;
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
      // a woman is about a third as likely as a man of her age to serve, on a base where most men in the households
      // serve too (a fixed shift of the log-odds would put half the wives in uniform and leave no civilian men)
      const goal = Math.min(milTarget, 0.9 * sum(workers)), at = b => { let s = 0; for (let i = 0; i < 200; i++) s += workers[i] * (i >= 100 ? MIL_F : 1) * sigmoid(b + MIL_LOGIT(i % 100)); return s; };
      let lo = -40, hi = 40;
      for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (at(mid) < goal) lo = mid; else hi = mid; }
      const b = (lo + hi) / 2;
      M.pMil = Float32Array.from({ length: 200 }, (_, i) => (i >= 100 ? MIL_F : 1) * sigmoid(b + MIL_LOGIT(i % 100)));
    }

    // occupation by sex and age band (C24010 against an age profile)
    const occ = this._blk(zi, 'occ', 60);
    M.occ = [];
    for (let s = 0; s < 2; s++) {
      const rows = new Float64Array(NOB);
      for (let a = 16; a <= MAX_AGE; a++) rows[occBand(a)] += workers[s * 100 + a] * (M.pMil ? 1 - M.pMil[s * 100 + a] : 1);
      let cols = occ.subarray(s * 25, s * 25 + 25);
      if (!(sum(cols) > 0)) cols = occ.subarray((1 - s) * 25, (1 - s) * 25 + 25);
      const prior = new Float64Array(NOB * 25);
      for (let b = 0; b < NOB; b++) OCC_GROUPS.forEach((g, j) => { prior[b * 25 + j] = occAgeWeight(g, b); });
      const om = ipf(prior, NOB, 25, rows, cols);
      for (let b = 0; b < NOB; b++) {
        const row = om.subarray(b * 25, b * 25 + 25), tb = new Table(row);
        // a band the ZIP has no workers in keeps the prior's shape (never a group the band rules out)
        M.occ.push(tb.empty ? new Table(prior.subarray(b * 25, b * 25 + 25)) : tb);
      }
    }

    // commute mode by car access, and time by mode (B08301 x B08303)
    const comm = this._blk(zi, 'comm', 60), ctime = this._blk(zi, 'ctime', 60), cTot = sum(comm) || 1;
    // who works from home: by occupation group, shifted so the ZIP's share matches B08301
    const ng = new Float64Array(26);
    for (let s = 0; s < 2; s++) for (let a = 16; a <= MAX_AGE; a++) {
      const wk = workers[s * 100 + a], mil = M.pMil ? M.pMil[s * 100 + a] : 0, T = M.occ[s * NOB + occBand(a)];
      ng[25] += wk * mil;
      if (T.empty) continue;
      // the alias table's own probabilities: entry j is chosen with prob[j]/n directly plus the aliases pointing at it
      for (let j = 0; j < T.n; j++) { ng[j] += wk * (1 - mil) * T.prob[j] / T.n; ng[T.alias[j]] += wk * (1 - mil) * (1 - T.prob[j]) / T.n; }
    }
    const gWfh = solveShift(ng, WFH_LOGIT, sum(ng) * comm[M_WFH] / cTot);
    M.pWfh = Float32Array.from(WFH_LOGIT, v => v > -40 ? sigmoid(gWfh + v) : 0);
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
    // km per unit across (x, at the ZIP's latitude) and down (y): straight-line distances from its homes
    const lat = Number.isFinite(z.lat[zi]) ? z.lat[zi] : this.world.unproject(z.tx[zi], z.ty[zi]).lat;
    M.ky = this.world.unitKm; M.kx = this.world.unitKm * Math.cos(lat * Math.PI / 180) / this.world.proj.kx;
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
      for (let r = 1; r < NROLE; r++) {
        let v = 0;
        for (let rk = RK_FIRST[r]; rk < RK_FIRST[r] + RK_COUNT[r]; rk++) {
          const q = g * NRK + rk;
          let x = 0; for (let k = R.off[q]; k < R.off[q + 1]; k++) x += R.val[k] * pw[R.idx[k]];
          v += M.mix[rk] * x;
        }
        RW[g * NROLE + r] = v;
      }
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

  /**
   * A workplace ZIP for a trip of about D km from ZIP zi (gravity by establishments within the band holding D); for
   * farm work (farm) the establishments are weighed by how much farm country each ZIP is (FARM_LAND).
   */
  _pickWorkZip(zi, D, u, farm = false) {
    const B = this._workBands(zi), cum = farm ? this._farmCum(zi) : B.cum;
    let b = 0;
    while (b < NWB - 1 && D >= BAND_EDGES[b + 1]) b++;
    for (let step = 0; step < NWB; step++) {
      for (let side = 0; side < (step ? 2 : 1); side++) {
        const bb = side ? b + step : b - step;
        if (bb < 0 || bb >= NWB) continue;
        const s = B.start[bb], e = B.start[bb + 1];
        if (e <= s) continue;
        const x = u * cum[e - 1];
        let lo = s, hi = e - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > x) hi = mid; else lo = mid + 1; }
        return B.ids[lo];
      }
    }
    return zi;
  }

  /** The distance bands of _workBands with farm work's weights (establishments times FARM_LAND), built on first use. */
  _farmCum(zi) {
    const B = this._workBands(zi);
    if (B.farm) return B.farm;
    const z = this.world.z, cum = new Float32Array(B.ids.length);
    for (let b = 0; b < NWB; b++) {
      let c = 0;
      for (let i = B.start[b]; i < B.start[b + 1]; i++) { const j = B.ids[i]; c += ((z.est[j] || 0) + 0.004 * (z.hh[j] || 0) + 0.05) * FARM_LAND(z.density[j] || 0); cum[i] = c; }
    }
    return (B.farm = cum);
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

  /**
   * Where active-duty members living in ZIP zi report. Bases are the ZIPs where service members are at least a
   * quarter of the workers (the installations and their housing, not the towns around them), weighted by how many
   * serve there (count times share squared, so a base outweighs a Navy town) and by distance; the home ZIP counts
   * when it is a base itself. Null when no base is within reach (recruiters, reserve centers: the usual workplace
   * choice then).
   */
  _bases(zi) {
    let B = this._baseCache[zi];
    if (B !== undefined) return B;
    this._milWeights();
    const near = this._near(zi, 110), ids = [], km = [], wts = [];
    for (let i = 0; i < near.ids.length; i++) { const j = near.ids[i], m = this._milWeight[j]; if (m > 0) { ids.push(j); km.push(near.km[i]); wts.push(m * Math.exp(-near.km[i] / 35)); } }
    B = ids.length ? { ids: Uint16Array.from(ids), km: Float32Array.from(km), w: Float64Array.from(wts), home: this._milWeight[zi] > 0 } : null;
    return (this._baseCache[zi] = B);
  }

  /** Per ZIP: how much of a base it is (service members times their share squared, where they are 25%+ of the workers). */
  _milWeights() {
    if (!this._milWeight) {
      const w = this.world;
      this._milWeight = new Float32Array(w.N);
      for (let i = 0; i < w.N; i++) { const e = w.acs(i, 'emp'), m = e[2], share = m / Math.max(1, e[0] + m); if (m >= 30 && share >= 0.25) this._milWeight[i] = m * share * share; }
    }
    return this._milWeight;
  }

  /**
   * The installation (INSTALLATIONS) a workplace at (x, y) in ZIP wz belongs to: the one whose grounds and ranges hold
   * the point, else, for a workplace in a base ZIP (a base and its housing), the nearest within 60 km; null for a
   * workplace off base.
   */
  _installationAt(x, y, wz) {
    const w = this.world;
    if (!this._inst) this._inst = INSTALLATIONS.map(b => ({ ...b, ...w.project(b.lat, b.lon) }));
    let best = null, bq = Infinity, near = null, nd = Infinity;
    for (const b of this._inst) {
      const d = w.distKm(x, y, b.x, b.y);
      if (d <= b.km && d / b.km < bq) { bq = d / b.km; best = b; }
      if (d < nd) { nd = d; near = b; }
    }
    if (best) return best;
    return wz >= 0 && this._milWeights()[wz] > 0 && nd <= 60 ? near : null;
  }

  /**
   * A point D km from home inside an installation's grounds and ranges (inst, from _installationAt), on the map, in a
   * direction drawn from r (up to six tries): {x, y, zi}, or null when the grounds do not reach that far from home.
   */
  _rangePoint(home, D, M, r, inst) {
    const w = this.world, R = w.raster();
    for (let t = 0; t < 6; t++) {
      const a = 2 * Math.PI * r.float(), x = home.x + Math.cos(a) * D / M.kx, y = home.y + Math.sin(a) * D / M.ky;
      if (w.distKm(x, y, inst.x, inst.y) > inst.km) continue;
      const c = Math.floor(x / R.cell), row = Math.floor(y / R.cell);
      if (c < 0 || row < 0 || c >= R.W || row >= R.H) continue;
      const g = R.grid[row * R.W + c];
      if (g) return { x, y, zi: g - 1 };
    }
    return null;
  }

  /**
   * A service member's branch (a MILITARY_BRANCHES key): the mix of the installation they report to; one who lives on
   * a base (in a base ZIP) and works off it is of that base's service; null for the others (the place decides).
   */
  _branchOf(p, hs, i, zi, home) {
    const b = (p.work ? this._installationAt(p.work.x, p.work.y, p.workZi) : null) || (this._milWeights()[zi] > 0 ? this._installationAt(home.x, home.y, zi) : null);
    if (!b) return null;
    const u = uni(hs, i, KA.BRANCH);
    let k = 0;
    while (k < b.cum.length - 1 && u >= b.cum[k]) k++;
    return b.branches[k];
  }

  /**
   * A base for a trip of about D km: the bases within reach of it (at most 1.6 D + 15 km away) by size and distance,
   * favoring those about that far; -1 when none is in reach (the member then works at an ordinary workplace: a
   * recruiting office, a reserve center, a headquarters in town).
   */
  _pickBase(B, D, u) {
    const s = 3 + 0.5 * D, reach = 1.6 * D + 15;
    let tot = 0;
    for (let i = 0; i < B.ids.length; i++) if (B.km[i] <= reach) tot += B.w[i] * Math.exp(-Math.abs(B.km[i] - D) / s);
    if (!(tot > 0)) return -1;
    let x = u * tot, last = -1;
    for (let i = 0; i < B.ids.length; i++) {
      if (B.km[i] > reach) continue;
      last = B.ids[i];
      x -= B.w[i] * Math.exp(-Math.abs(B.km[i] - D) / s);
      if (x < 0) return B.ids[i];
    }
    return last;
  }

  /**
   * A workplace about D km from home (a trip under 15 km): four directions drawn from r, each landing in a ZIP
   * weighted like the gravity model (establishments, then households); in a rural ZIP, whose jobs are in town, its
   * own workplace site when one is about that far from home; else the point itself. {x, y, zi}, or null when every
   * direction is off the map. Measured from the home, not the ZIP's town point, so a trip from the edge of a big
   * rural ZIP stays its length. Farm work (farm) weighs each direction by how much farm country it lands in (FARM_LAND).
   */
  _workNear(home, D, M, r, farm = false) {
    const R = this.world.raster(), z = this.world.z, cand = SCR_CAND;
    let n = 0, tot = 0;
    for (let t = 0; t < 4; t++) {
      const a = 2 * Math.PI * r.float(), x = home.x + Math.cos(a) * D / M.kx, y = home.y + Math.sin(a) * D / M.ky;
      const c = Math.floor(x / R.cell), row = Math.floor(y / R.cell);
      if (c < 0 || row < 0 || c >= R.W || row >= R.H) continue;
      const g = R.grid[row * R.W + c];
      if (!g) continue;
      const wgt = ((z.est[g - 1] || 0) + 0.004 * (z.hh[g - 1] || 0) + 0.05) * (farm ? FARM_LAND(z.density[g - 1] || 0) : 1);
      cand[4 * n] = x; cand[4 * n + 1] = y; cand[4 * n + 2] = g - 1; cand[4 * n + 3] = wgt; tot += wgt; n++;
    }
    if (!n) return null;
    let u = r.float() * tot, k = 0;
    while (k < n - 1 && u >= cand[4 * k + 3]) { u -= cand[4 * k + 3]; k++; }
    const zi = cand[4 * k + 2];
    if ((z.density[zi] || 0) < 1500) {
      const S = this._sites(zi), j = siteNear(S, home, D, M);
      const dx = (S[2 * j] - home.x) * M.kx, dy = (S[2 * j + 1] - home.y) * M.ky, d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 0.7 * D && d <= 1.3 * D) return { x: S[2 * j], y: S[2 * j + 1], zi };
    }
    return { x: cand[4 * k], y: cand[4 * k + 1], zi };
  }

  /**
   * A point D km from home in a direction drawn from r (up to four tries), on the ZIP raster: {x, y, zi}, or null
   * when every try lands off the map (the ocean, the state line) or, for a service member (onBase), off a base.
   */
  _pointAt(home, D, M, r, onBase = false) {
    const R = this.world.raster();
    for (let t = 0; t < 4; t++) {
      const a = 2 * Math.PI * r.float(), x = home.x + Math.cos(a) * D / M.kx, y = home.y + Math.sin(a) * D / M.ky;
      const c = Math.floor(x / R.cell), row = Math.floor(y / R.cell);
      if (c < 0 || row < 0 || c >= R.W || row >= R.H) continue;
      const g = R.grid[row * R.W + c];
      if (g && (!onBase || this._milWeight[g - 1] > 0)) return { x, y, zi: g - 1 };
    }
    return null;
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
   * behind departMin, and `workDays`, the bit mask of the days they work or attend school (Sun = 1 ... Sat = 64).
   * `days` is the commute days only, so it is 0 for someone working from home (their workDays still say when
   * they work). The commute of a K-12 student (even one with a part-time job) is the school trip.
   * @param {number} zi ZIP index
   * @param {number} h household index, 0 <= h < world.z.hh[zi] (any larger index gives a synthetic household)
   * @returns {object} HouseholdCore
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
    const home = w.homeFor(zi, h);

    // who lives here
    // the members' roles, sexes, ages and heritages, in scratch arrays reused by every call (no allocation)
    const roles = SCR_ROLE, sexes = SCR_SEX, ages = SCR_AGE, hers = SCR_HER;
    roles[0] = R_HH; sexes[0] = hs; ages[0] = a0; hers[0] = H;
    let n = 1;
    let spouseHer = -1, spouseAge = -1, spouseSex = -1, parents = 0, firstParentSex = -1, parentInLaw = false, sibs = false;
    // a grown child with children of their own here: once one is drawn (gpar is that member when the householder is
    // old enough to have one) the later slots draw from MIXES_AFTER, and a grandchild's age follows that parent's
    let gpar = -1, gparDrawn = false;
    const young = BAND_LO[band] < GPAR_BAND_LO;
    for (let k = C_SLOT_OFF[ci]; k < C_SLOT_OFF[ci + 1]; k++) {
      const mix = (young ? MIX_CUM_YOUNG : gparDrawn ? MIX_CUM_AFTER : MIX_CUM)[C_SLOTS[k]];
      let role = mix[0][0];
      if (mix.length > 1) { const u = r.float(); for (let q = 0; q < mix.length; q++) { role = mix[q][0]; if (u < mix[q][1]) break; } }
      if (role === R_GPAR) gparDrawn = true;
      if (!ROLE_OK[(role * 2 + hs) * NA + a0 - A0] || (role === R_GRAND && gpar < 0)) role = R_REL;
      // the householder's parents are one couple at most, a mother and a father
      if ((role === R_PARENT || role === R_PARENT2) && parents >= 2) role = R_REL;
      let path, sex, anchor = a0;
      switch (role) {
        case R_SPOUSE: if (r.float() < 0.985) { path = hs ? P_SP_F : P_SP_M; sex = 1 - hs; } else { path = P_SP_S; sex = hs; } break;
        case R_PARTNER: if (r.float() < 0.93) { path = hs ? P_PA_F : P_PA_M; sex = 1 - hs; } else { path = P_PA_S; sex = hs; } break;
        case R_CHILD: { const u = r.float(); path = CHILD_PATHS[hs][u < M.piChild[0] ? 0 : u < M.piChild[1] ? 1 : u < M.piChild[2] ? 2 : 3]; sex = r.float() < 0.515 ? 0 : 1; break; }
        case R_GPAR: path = hs ? P_GPAR_F : P_GPAR_M; sex = r.float() < GPAR_FEMALE ? 1 : 0; break;
        case R_GRAND: path = sexes[gpar] ? P_GPC_F : P_GPC_M; anchor = ages[gpar]; sex = r.float() < 0.515 ? 0 : 1; break;
        case R_PARENT: case R_PARENT2:
          path = P_PAR;
          sex = parents ? 1 - firstParentSex : role === R_PARENT ? (r.float() < 0.66 ? 1 : 0) : (r.float() < 0.66 ? 0 : 1);
          if (!parents) firstParentSex = sex;
          parents++;
          break;
        case R_SIB: path = P_SIB; sex = r.float() < 0.5 ? 0 : 1; sibs = true; break;
        case R_ROOM: path = r.float() < M.piPeer ? P_RM_PEER : P_RM_WIDE; sex = r.float() < 0.62 ? hs : 1 - hs; break;
        default: path = P_REL; sex = r.float() < 0.5 ? 0 : 1;
      }
      let age = drawPathAge(path, anchor, r.float());
      // a child of the couple is also clearly younger than the spouse or partner, and their mother here (the
      // householder or the wife) no older than 48 at the birth (up to three redraws: stepchildren stay possible, a
      // stepparent barely older than the child does not, nor a 65-year-old mother of a 7-year-old)
      const mom = hs ? a0 : spouseSex === 1 ? spouseAge : -1;
      for (let t = 0; t < 3 && (role === R_CHILD || role === R_GPAR) && ((spouseAge >= 0 && age > spouseAge - 15) || (mom >= 0 && mom - age > 48)); t++) age = drawPathAge(path, a0, r.float());
      let her;
      if (role === R_SPOUSE || role === R_PARTNER) {
        her = r.float() < M.qRace ? (r.float() < Q_KEY[g] ? H : M.herWithin[g].pick(r)) : M.herNotG[g].pick(r);
        if (spouseHer < 0) { spouseHer = her; spouseAge = age; spouseSex = sex; }
      } else if (role === R_CHILD || role === R_GRAND || role === R_GPAR) her = spouseHer < 0 ? H : childHeritage(H, spouseHer, r);
      else if (role === R_ROOM) her = r.float() < 0.45 ? M.herWithin[g].pick(r) : M.herPi.pick(r);
      else {
        // a tenth of the parents, siblings and other relatives are the spouse's; a parent couple is one side's
        const inLaw = spouseHer >= 0 && r.float() < 0.1;
        if ((role === R_PARENT || role === R_PARENT2) && parents > 1) her = parentInLaw ? spouseHer : H;
        else { her = inLaw ? spouseHer : H; if (role === R_PARENT || role === R_PARENT2) parentInLaw = inLaw; }
      }
      if (role === R_GPAR && gpar < 0) gpar = n;
      roles[n] = role; sexes[n] = sex; ages[n] = age; hers[n] = her; n++;
    }
    // brothers and sisters living with parents are of an age to be their children
    if (sibs && parents) fitSiblings(roles, sexes, ages, hers, n, H, spouseHer, r);

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
        else occ = OCC_GROUPS[M.occ[sex * NOB + occBand(age)].pick(r)];
      }
      const p = { m, role: ROLE_NAMES[roles[m]], sex: sex ? 'F' : 'M', age, heritage: HERITAGE_KEYS[hers[m]], worker, military, occ, student: STUDENT_KEYS[st], mode: null, commuteMin: 0, departMin: null, dwellMin: 0, days: 0, workDays: 0, workZi: -1, work: null, shift: null };
      if (st === 1 || st === 2) this._schoolTrip(p, zi, hk, home, M, vehicles, r);
      else if (worker) this._workTrip(p, zi, hk, home, M, vehicles, r);
      else if (st >= 3) this._collegeTrip(p, zi, hk, home, M, vehicles, r);
      members[m] = p;
    }
    return { zi, h, id: w.zips[zi] + '-' + h, size, type: TYPES[type], tenure: own ? 'own' : 'rent', dwelling: DWELLINGS[dwelling], vehicles, home, heritage: HERITAGE_KEYS[H], members };
  }

  /**
   * A child's school day: the nearest school of their level in the home ZIP (siblings share it). The mode follows the
   * distance (walking when it is close, a bike or the bus a little farther, otherwise a ride or the school bus) and
   * the minutes follow the mode and the distance. School starts about 8:00, each school at its own bell (+/- 20 min).
   */
  _schoolTrip(p, zi, hk, home, M, vehicles, r) {
    const level = p.student === 'preschool' || p.age <= 10 ? 0 : p.age <= 13 ? 1 : 2;
    const S = this._schools(zi)[level], K = S.length >> 1;
    let site = 0, bd = Infinity;
    for (let k = 0; k < K; k++) { const dx = (S[2 * k] - home.x) * M.kx, dy = (S[2 * k + 1] - home.y) * M.ky, d = dx * dx + dy * dy; if (d < bd) { bd = d; site = k; } }
    const km = Math.sqrt(bd), urb = M.urban;
    p.workZi = zi; p.work = { x: S[2 * site], y: S[2 * site + 1] };
    // relative weights of walking, cycling, a bus, a ride (a parent or a carpool) and driving themselves
    let wWalk = 0, wBike = 0, wBus = 0, wDrive = 0;
    const wRide = 1;
    if (p.student === 'preschool') { if (km < 0.8) wWalk = 0.3 + 0.3 * urb; }
    else if (km <= (level ? 1.6 : 1.2) * (1 + 0.3 * urb)) { wWalk = 2.2 + 0.6 * urb; wBike = p.age >= 9 ? 0.2 : 0; }
    else if (km <= 3.5) { wWalk = km <= 2.2 && level ? 0.35 : 0; wBike = p.age >= 9 ? 0.2 + 0.1 * urb : 0; wBus = 0.25 + 0.2 * urb + (level === 2 ? 0.15 : 0); }
    else { wBike = p.age >= 11 && km < 6 ? 0.06 : 0; wBus = 0.5 + 0.4 * (1 - urb) + (level ? 0.15 : 0); }
    if (p.age >= 16 && vehicles >= 2 && km > 1) wDrive = 0.3;
    const u = r.float() * (wWalk + wBike + wBus + wRide + wDrive);
    const mode = u < wWalk ? 'walk' : u < wWalk + wBike ? 'bike' : u < wWalk + wBike + wBus ? 'bus' : u < wWalk + wBike + wBus + wRide ? 'carpool' : 'drive';
    const road = km * ROAD;
    const minutes = mode === 'walk' ? 2 + road / 4.2 * 60 : mode === 'bike' ? 2 + road / 11 * 60
      : mode === 'bus' ? 6 + road / (15 + 15 * (1 - urb)) * 60 : 3 + road / (22 + 18 * (1 - urb)) * 60;
    p.mode = mode;
    // siblings going to one school the same way go together: the trip's extra minutes and how early they leave come
    // from the household, the school and the mode, not the child
    const hj = mix32(hk ^ Math.imul(level * 64 + site + 1, 0x2545f491) ^ (mode.charCodeAt(0) << 8 | mode.length));
    p.commuteMin = Math.max(3, Math.round(minutes) + hj % 3);
    const start = p.student === 'preschool' ? 450 + 15 * r.int(7) : 480 + 10 * ((mix32(hash2(zi, level * 64 + site)) % 5) - 2);
    p.departMin = start - p.commuteMin - (hj >>> 8) % 6;
    p.dwellMin = p.student === 'preschool' ? (r.float() < 0.5 ? 180 + 15 * r.int(5) : 480 + 15 * r.int(7)) : [390, 405, 420][level] + (r.float() < 0.3 ? 60 + 15 * r.int(7) : 0);
    p.days = p.workDays = 62;
    if (p.worker) p.shift = 'evening';
  }

  /**
   * A worker's day: shift, work days and hours from the occupation group; working from home by group (B08301); else
   * the mode (B08301 by car access) and minutes (B08303), and a workplace at the distance those imply: under 15 km
   * measured from the home itself (gravity by establishments over a few directions), beyond that a ZIP in the
   * distance band (gravity by establishments). Service members report to a base within reach of their trip. Minutes
   * never imply an impossible speed: a destination farther than the minutes allow lengthens the trip.
   */
  _workTrip(p, zi, hk, home, M, vehicles, r) {
    const gkey = p.military ? 'military' : p.occ, prof = GROUP_PROFILES[gkey], pc = PROFILE_CUM[gkey];
    const us = r.float();
    let si = 0;
    while (si < SHIFT_KEYS.length - 1 && us >= pc[si]) si++;
    const shift = SHIFT_KEYS[si];
    const partTime = shift !== 'h24' && r.float() < prof.partTime * (p.age < 25 || p.age >= 65 ? 1.6 : 1);
    const long = !partTime && shift !== 'h24' && r.float() < prof.long;
    p.shift = shift;
    const days = workDays(prof, shift, partTime, long, r);
    p.workDays = days;
    p.dwellMin = dwellFor(gkey, shift, partTime, long, popcount(days), r);
    // working from home: no commute, so no commute days
    if (r.float() < M.pWfh[p.military ? 25 : OCC_IDX[p.occ]]) { p.mode = 'wfh'; return; }
    p.days = days;
    let mi = (vehicles > 0 ? M.modeCar : M.modeNoCar).pick(r);
    const tb = M.time[mi].pick(r);
    let minutes = tb === NCT - 1 ? Math.min(150, 90 + Math.floor(-Math.log(1 - r.float()) * 22)) : CT_LO[tb] + r.int(CT_HI[tb] - CT_LO[tb] + 1);
    // the distance the mode and minutes imply; service members report to a base about that far
    const D = tripKm(mi, minutes, M.urban) * Math.exp(0.35 * r.gauss());
    const B = p.military ? this._bases(zi) : null;
    // farm work is in the fields: its workplaces are weighed toward farm country (FARM_LAND), not the city's offices
    const farm = p.occ === 'farming';
    let x, y, onBase = false;
    // a short trip (a walk, a bike ride, a hop by car) ends that far from home, wherever that is; a trip under 15 km
    // at a workplace that far from the home (not from the ZIP's town point: big rural ZIPs); a service member's on base
    const pt = B ? (D < 3 && B.home ? this._pointAt(home, D, M, r, true) : null) : D < 3 ? this._pointAt(home, D, M, r) : D < 15 ? this._workNear(home, D, M, r, farm) : null;
    if (pt) { p.workZi = pt.zi; x = pt.x; y = pt.y; onBase = !!B; }
    else {
      let S, k;
      const base = B ? this._pickBase(B, D, r.float()) : -1;
      if (base >= 0) { p.workZi = base; S = this._sites(base); k = siteNear(S, home, D, M); onBase = true; }
      else {
        p.workZi = this._pickWorkZip(zi, D, r.float(), farm);
        S = this._sites(p.workZi);
        // a shorter trip ends at the workplace about that far from home; a long one at any of the ZIP's workplaces
        k = D < 8 ? siteNear(S, home, D, M) : (mix32(hk + Math.imul(p.m + 1, 0x2545f491)) >>> 0) % (S.length >> 1);
      }
      x = S[2 * k]; y = S[2 * k + 1];
    }
    let dx = (x - home.x) * M.kx, dy = (y - home.y) * M.ky, km = Math.sqrt(dx * dx + dy * dy);
    // a service member whose base workplace is far nearer than the trip's minutes: the installation's ranges about that
    // far, when its grounds reach so far; else the minutes shrink to the distance (below): members serve at their base
    if (onBase && D > 4 && km < 0.4 * D) {
      const inst = this._installationAt(x, y, p.workZi), far = inst ? this._rangePoint(home, D, M, r, inst) : null;
      if (far) { p.workZi = far.zi; x = far.x; y = far.y; dx = (x - home.x) * M.kx; dy = (y - home.y) * M.ky; km = Math.sqrt(dx * dx + dy * dy); }
    }
    // a walk or ride longer than an hour and a quarter is made by car instead (a ride when the household has none)
    if ((mi === M_WALK || mi === M_BIKE) && OVER_MIN[mi] + km * ROAD / VMAX[mi] * 60 > 75) {
      mi = vehicles > 0 ? M_DRIVE : M_CARPOOL;
      minutes = Math.max(minutes, Math.round(OVERHEAD[mi] + km * ROAD / tripSpeed(mi, M.urban) * 60));
    }
    const need = Math.ceil(OVER_MIN[mi] + km * ROAD / VMAX[mi] * 60);
    // too few minutes for the distance: the least it takes, plus a little that stays in the same B08303 bracket (a
    // one-minute drive becomes three or four, not six)
    if (minutes < need) { let b = 0; while (b < NCT - 1 && need > CT_HI[b]) b++; minutes = need + r.int(Math.max(1, Math.min(4, CT_HI[b] - need + 1))); }
    // on base the trip takes what its distance does, with the gate, the lot and the walk in (never a crawl)
    if (onBase) minutes = Math.min(minutes, Math.ceil(OVERHEAD[mi] + 10 + 1.5 * km * ROAD / tripSpeed(mi, M.urban) * 60));
    p.mode = MODES[mi];
    p.commuteMin = Math.min(minutes, 240);
    p.work = { x, y };
    p.departMin = (((startMinute(shift, gkey, r) - p.commuteMin - r.int(8)) % 1440) + 1440) % 1440;
  }

  /**
   * A college or graduate student's trip: the campus first (school establishments by distance), then the way there
   * that its distance allows (walking across a college town, a bike, transit where the ZIP rides it, a car) and the
   * minutes that takes.
   */
  _collegeTrip(p, zi, hk, home, M, vehicles, r) {
    const C = this._colleges(zi);
    p.workZi = C.ids[C.table.pick(r)];
    const S = this._sites(p.workZi), k = (mix32(hk + Math.imul(p.m + 1, 0x2545f491)) >>> 0) % (S.length >> 1);
    const x = S[2 * k], y = S[2 * k + 1], dx = (x - home.x) * M.kx, dy = (y - home.y) * M.ky, km = Math.sqrt(dx * dx + dy * dy);
    const urb = M.urban, bus = M.commShares[M_BUS], rail = M.commShares[M_RAIL], transit = r.float() * (bus + rail) < rail ? M_RAIL : M_BUS;
    // each way's minutes over this distance; a way that would take well over an hour is rarely chosen
    const time = mi => OVERHEAD[mi] + km * ROAD / tripSpeed(mi, urb) * 60, ok = mi => { const t = time(mi); return t <= 60 ? 1 : Math.exp(-(t - 60) / 15); };
    const wWalk = (km < 1.2 ? 1.2 : km < 2.5 ? 0.4 : 0) * ok(M_WALK), wBike = (km < 8 ? 0.25 + 0.25 * urb : 0) * ok(M_BIKE);
    const wTransit = (km > 1 ? 0.05 + 2 * (bus + rail) : 0) * ok(transit), wCar = vehicles > 0 ? (km > 2 ? 1 : 0.3) : 0, wRide = 0.15 + (vehicles > 0 ? 0 : 0.3);
    const u = r.float() * (wWalk + wBike + wTransit + wCar + wRide);
    const mi = u < wWalk ? M_WALK : u < wWalk + wBike ? M_BIKE : u < wWalk + wBike + wTransit ? transit : u < wWalk + wBike + wTransit + wCar ? M_DRIVE : M_CARPOOL;
    let minutes = Math.max(3, Math.round(time(mi)) + r.int(5));
    const need = Math.ceil(OVER_MIN[mi] + km * ROAD / VMAX[mi] * 60);
    if (minutes < need) minutes = need + r.int(4);
    p.mode = MODES[mi];
    p.commuteMin = Math.min(minutes, 240);
    p.work = { x, y };
    p.departMin = 480 + 30 * r.int(8) - p.commuteMin - r.int(10);
    if (p.student === 'grad') { p.dwellMin = 360 + 30 * r.int(6); p.days = 62; }
    else { p.dwellMin = 180 + 30 * r.int(8); const v = r.float(); p.days = v < 0.6 ? 62 : v < 0.8 ? 42 : 20; }
    p.workDays = p.days;
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
   * B12001 (marital status, people 15+), B21001 (veterans, civilians 18+) and B23025 (employment, people 16+) of ZIP
   * zi for its household population: the estimated group-quarters residents (by age and sex, as the age pyramid
   * leaves them out) taken out of the Census counts. Those under 65 (barracks, dorms, prisons) come mostly from the
   * never married and from the non-veterans of their age band; those 65 and older (nursing homes) across their sex's
   * marital statuses. On a base they are the barracks' service members: out of the armed forces of B23025, and never
   * in B21001, which counts civilians.
   * @returns {{mar: Float64Array, vet: Float64Array, emp: Float64Array}} the blocks in the pack's layout
   */
  _hhCensus(zi, M = this._core(zi)) {
    const mar = this._blk(zi, 'mar', 60), vet = this._blk(zi, 'vet', 60), emp = this._blk(zi, 'emp', 60), G = M.gqAS;
    if (!(M.gq > 0) || !G) return { mar, vet, emp };
    const base = this._milWeights()[zi] > 0;
    if (base) {
      let g16 = 0;
      for (let b = 3; b < NB; b++) g16 += G[b] + G[NB + b];
      g16 -= (G[3] + G[NB + 3]) / 3;   // 15-17: the 15-year-olds are not 16+
      const m = Math.min(emp[2], g16);
      emp[2] -= m; emp[3] = Math.max(0, emp[3] - (g16 - m));
    }
    // take `amount` from cells o..o+5 of mar in proportion to weights w, never below zero (the overflow from the rest)
    const take = (o, amount, w) => {
      if (!(amount > 0)) return;
      let tw = 0; for (let k = 0; k < 6; k++) tw += w[k];
      let left = amount;
      for (let k = 0; k < 6; k++) { const d = Math.min(mar[o + k], amount * w[k] / tw); mar[o + k] -= d; left -= d; }
      const rest = sum(mar.subarray(o, o + 6));
      if (left > 0 && rest > 0) for (let k = 0; k < 6; k++) mar[o + k] -= Math.min(mar[o + k], left * mar[o + k] / rest);
    };
    for (let s = 0; s < 2; s++) {
      let young = 0, old = 0;
      for (let b = 3; b < NB; b++) { if (b <= 16) young += G[s * NB + b]; else old += G[s * NB + b]; }   // 15+
      take(s * 6, young, [0.85, 0.05, 0.03, 0, 0, 0.07]);   // never married, married, separated, absent, widowed, divorced
      take(s * 6, old, Array.from(mar.subarray(s * 6, s * 6 + 6)));
      if (base) continue;
      for (let k = 0; k < 5; k++) {
        let g = 0;
        for (let b = 4; b < NB; b++) if (VET_BAND_OF[b] === k) g += G[s * NB + b];
        const cell = s * 10 + 5 + k;
        vet[cell] = Math.max(0, vet[cell] - g);
      }
    }
    return { mar, vet, emp };
  }

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
    // Sikh write-ins (B02015) mark Punjabi Sikh communities: Indian households there speak Punjabi more often, and
    // more of the Punjabi-speaking Indian families are Sikh (most are anywhere in California: the write-ins are only
    // the Sikhs who did not report themselves as Asian Indian)
    F.punjabi = 1 + 50 * sik / Math.max(1, ind + sik);
    F.pSikh = clamp(0.8 + 1.5 * sik / Math.max(1, ind + sik), 0.8, 0.95);
    const syn = [];
    for (let s = 0; s < SYN_N; s++) { const h = SYN_BASE + s, core = this.householdCore(zi, h), hs = this._hseed(zi, h); syn.push({ core, hs, ori: this._origins(core, hs, F) }); }

    // nativity: one shift alpha so the foreign-born share matches B05012
    const nat = this._blk(zi, 'nat', 60), fTarget = nat[1] / ((nat[0] + nat[1]) || 1);
    for (const x of syn) { x.kin = kinship(x.core.members); x.P = natPrep(x.core, x.ori, x.hs, x.kin); x.N = natResult(x.core.size); }
    // the share counts each adult's chance of being foreign born (its expectation, not the draw: 700 households of
    // correlated draws would leave a couple of points of noise in the shift) and each child as drawn (they follow
    // their parents' draws); people born before their origin's community began are foreign or territory born outright
    const foreignShare = a => {
      let f = 0, t = 0;
      for (const x of syn) {
        natDecide(x.P, a, x.N);
        const P = x.P, pOf = i => (P.force[i] === 1 ? 1 : P.force[i] === 2 ? 0 : sigmoid(a + P.off[i]));
        for (let i = 0; i < x.core.size; i++) {
          t++;
          const role = P.role[i];
          if (role === R_CHILD || role === R_GRAND) { f += x.N.nat[i]; continue; }
          if (i > 0 && P.force[i]) { f += P.force[i] === 1 ? 1 : 0; continue; }
          // parents and siblings lean to the nativity of the member they belong with (the householder, or the spouse)
          const p = pOf(i), pa = pOf(P.anchor[i]);
          f += i > 0 && (role === R_PARENT || role === R_SIB) ? pa * (1 - (1 - p) * 0.1) + (1 - pa) * p : p;
        }
      }
      return t ? f / t : 0;
    };
    F.alpha = rootMonotone(a => foreignShare(a) - fTarget, -10, 10, 0.002 * Math.max(fTarget, 0.05));
    for (const x of syn) natDecide(x.P, F.alpha, x.N);

    // education 25+ by class (B15003). Job titles come first and education is drawn within each person's bounds (a
    // title's degree, a student's level), so the class rows are raked against the bounded draws until the ZIP's
    // education counts come back
    for (const x of syn) x.titles = this._titles(zi, x.core, x.hs);
    F.eduRows = this._fitEducation(syn, this._blk(zi, 'edu', 60));
    for (const x of syn) x.edu = eduDecide(x.core, x.hs, F.eduRows, x.titles);

    // language at home: bucket scales so the 12 non-English shares match C16001 among people 5+. The synthetic people
    // count by the ZIP's heritage mix (post-stratified: each heritage weighs its share of the ZIP's persons over its share
    // of the 700 households' people), so the scales fit the ZIP and not the luck of the sample: a sample a few points
    // short of Hispanic households would otherwise raise Spanish for every Hispanic family of the real ZIP
    const lang = this._blk(zi, 'lang', 60), tot5 = sum(lang.subarray(0, 13)) || 1;
    const target = Float64Array.from({ length: 13 }, (_, b) => lang[b] / tot5);
    const hCount = new Float64Array(NH);
    let hAll = 0;
    for (const x of syn) for (const p of x.core.members) { hCount[H_INDEX[p.heritage]]++; hAll++; }
    const hWeight = Float64Array.from(hCount, (c, h) => (c > 0 ? M.pi[h] * hAll / c : 0));
    // and within each heritage the foreign born count by their expected share (the draws of 700 households stray from
    // it; the shift alpha fits the expectation, see foreignShare)
    const eF = new Float64Array(NH), rF = new Float64Array(NH), nF = new Float64Array(NH);
    for (const x of syn) {
      const P = x.P, pOf = i => (P.force[i] === 1 ? 1 : P.force[i] === 2 ? 0 : sigmoid(F.alpha + P.off[i]));
      for (let i = 0; i < x.core.size; i++) {
        const h = H_INDEX[x.core.members[i].heritage], role = P.role[i];
        let e;
        if (role === R_CHILD || role === R_GRAND) e = x.N.nat[i];
        else if (i > 0 && P.force[i]) e = P.force[i] === 1 ? 1 : 0;
        else { const p = pOf(i), pa = pOf(P.anchor[i]); e = i > 0 && (role === R_PARENT || role === R_SIB) ? pa * (1 - (1 - p) * 0.1) + (1 - pa) * p : p; }
        eF[h] += e; rF[h] += x.N.nat[i]; nF[h]++;
      }
    }
    const natW = (h, f) => clamp(f ? (rF[h] > 0 ? eF[h] / rF[h] : 1) : (nF[h] > rF[h] ? (nF[h] - eF[h]) / (nF[h] - rF[h]) : 1), 0.25, 4);
    for (const x of syn) {
      x.L = langPrep(x.core, x.ori, x.N, x.edu, x.hs, F, x.P.by); x.LR = langResult(x.core.size);
      x.hw = Float64Array.from(x.core.members, (p, i) => { const h = H_INDEX[p.heritage]; return hWeight[h] * natW(h, x.N.nat[i]); });
    }
    const lambda = new Float64Array(13).fill(1);
    let kappa = 0;
    const shares = () => {
      const g = new Float64Array(13); let t = 0;
      for (const x of syn) { langDecide(x.L, lambda, kappa, x.LR); for (let i = 0; i < x.core.size; i++) { if (x.L.age[i] < 5) continue; t += x.hw[i]; g[x.LR.bucket[i]] += x.hw[i]; } }
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
    // limited English by bucket (C16001 counts of those who speak English less than very well): the bucket's level so
    // that its synthetic speakers' expected count matches, drawn toward the level that fits all the ZIP's speakers
    // together by LEP_PRIOR_N speakers' worth (a bucket only a few synthetic people speak would otherwise run to an
    // extreme to fit them); a bucket none of them speaks keeps the level at which a typical immigrant has its rate
    F.delta = new Float64Array(13);
    const byBucket = [], allK = [], allOff = [];
    let allGoal = 0;
    for (let b = 1; b < 13; b++) {
      const ks = [], off = [];
      for (const x of syn) for (let i = 0; i < x.core.size; i++) {
        if (x.L.age[i] < 5 || x.LR.bucket[i] !== b) continue;
        ks.push(x.L.k[i]); off.push(x.L.x[i] + (x.LR.crossed[i] ? -2 : 0));
      }
      const rate = lang[b] > 0 ? clamp(lang[12 + b] / lang[b], 0, 0.97) : 0.3;
      byBucket[b] = { ks, off, rate };
      for (let k = 0; k < ks.length; k++) { allK.push(ks[k]); allOff.push(off[k]); }
      allGoal += rate * ks.length;
    }
    const pooled = allK.length ? solveScaledShift(allK, allOff, allGoal) : 0;
    for (let b = 1; b < 13; b++) {
      const { ks, off, rate } = byBucket[b], m = ks.length;
      F.delta[b] = m ? (m * solveScaledShift(ks, off, rate * m) + LEP_PRIOR_N * pooled) / (m + LEP_PRIOR_N) : logit(clamp(rate, 0.02, 0.97)) - 0.3;
    }

    // unemployment among those not working (B23025)
    const emp = this._blk(zi, 'emp', 60), uShare = emp[1] / (sum(emp) || 1);
    let n16 = 0; const elig = [];
    for (const x of syn) for (const p of x.core.members) { if (p.age >= 16) n16++; if (p.age >= 16 && p.age < 65 && !p.worker && !p.student) elig.push(p.age < 25 ? 1.6 : p.age < 55 ? 1 : 0.6); }
    const uTarget = uShare * n16;
    let lo = 0, hi = 10;
    for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; let s = 0; for (const e of elig) s += Math.min(0.95, mid * e); if (s < uTarget) lo = mid; else hi = mid; }
    F.unemp = (lo + hi) / 2;

    // marital status of people not married by household structure (B12001, by sex and age band) and veterans (B21001),
    // both for the household population (the group-quarters residents taken out, as from the age pyramid)
    const { mar, vet } = this._hhCensus(zi);
    F.marRows = [];
    for (let s = 0; s < 2; s++) {
      const rowsM = new Float64Array(7);
      for (const x of syn) { const { out } = maritalFixed(x.core); x.core.members.forEach((p, i) => { if (out[i] < 0 && (p.sex === 'F') === (s === 1)) rowsM[marBand(p.age)]++; }); }
      const cols = [0, 2, 3, 4, 5].map(k => mar[s * 6 + k]);
      const mm = ipf(MAR_PRIOR.flat(), 7, 5, rowsM, cols, 30);
      for (let b = 0; b < 7; b++) { const r = mm.subarray(b * 5, b * 5 + 5), t = sum(r); F.marRows.push(t > 0 ? Float64Array.from(r, v => v / t) : Float64Array.from(MAR_PRIOR[b])); }
    }

    // veterans by sex and age band (B21001 rates)
    F.vetRate = new Float64Array(10);
    for (let s = 0; s < 2; s++) for (let b = 0; b < 5; b++) { const v = vet[s * 10 + b], nv = vet[s * 10 + 5 + b]; F.vetRate[s * 5 + b] = v + nv > 0 ? v / (v + nv) : 0; }

    // household income: the rank of a household's earning power among the ZIP's households maps to B19001. Nobody
    // is paid below the minimum wage for their hours: a household with workers ranked below a year of that worked part
    // of the year (partYear), and only one ranked below even the fewest weeks is lifted; the brackets of the mapping are
    // raked so that the incomes after that lift still give B19001
    const inc = syn.map(x => { const J = this._jobs(zi, x.core, x.titles, x.edu), floor = incomeFloorMin(J); return { s: incomeScore(J.pot, x.hs, floor), floor }; });
    F.incScores = Float64Array.from(inc, v => v.s).sort();
    const hinc = this._blk(zi, 'hinc', 60), ht = sum(hinc) || 1, goal = Float64Array.from(hinc, v => v / ht), brackets = Float64Array.from(goal), got = new Float64Array(16);
    for (let it = 0; it < 8; it++) {
      let c = 0;
      F.hincCum = Float64Array.from(brackets, v => (c += v));
      if (it === 7) break;
      got.fill(0);
      for (const v of inc) got[hincBracket(Math.max(this._householdIncome(F, v.s), v.floor))] += 1 / inc.length;
      let worst = 0;
      for (let b = 0; b < 16; b++) { worst = Math.max(worst, Math.abs(got[b] - goal[b])); brackets[b] = goal[b] > 0 ? brackets[b] * clamp(Math.sqrt(goal[b] / Math.max(got[b], 1e-4)), 0.5, 2) : 0; }
      const st = sum(brackets); for (let b = 0; b < 16; b++) brackets[b] /= st;
      if (worst < 0.004) { c = 0; F.hincCum = Float64Array.from(brackets, v => (c += v)); break; }
    }
    for (const x of syn) { x.P = x.L = x.LR = null; }
    return F;
  }

  /**
   * Education rows by class (NECLASS x NEDU, each summing to 1) for a ZIP: a national prior raked so that the
   * synthetic adults' draws, each within its eduBounds, add up to the ZIP's B15003 counts.
   */
  _fitEducation(syn, target) {
    const groups = new Map();
    for (const x of syn) x.core.members.forEach((p, i) => {
      if (p.age < 25) return;
      const [lo, hi] = eduBounds(p, x.titles[i] ? x.titles[i].t : null), key = eduClass(p) * 64 + lo * 8 + hi;
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    const rows = EDU_PRIOR.map(r => { const t = sum(r); return Float64Array.from(r, v => v / t); });
    const keys = [...groups.keys()], counts = keys.map(k => groups.get(k));
    let n = 0; for (const c of counts) n += c;
    const tt = sum(target), goal = Float64Array.from(target, v => tt > 0 ? v * n / tt : 0), S = new Float64Array(NEDU), f = new Float64Array(NEDU);
    for (let it = 0; it < 40; it++) {
      S.fill(0);
      for (let g = 0; g < keys.length; g++) {
        const key = keys[g], row = rows[key >> 6], lo = (key >> 3) & 7, hi = key & 7;
        let t = 0; for (let e = lo; e <= hi; e++) t += row[e];
        if (!(t > 0)) { S[lo] += counts[g]; continue; }
        for (let e = lo; e <= hi; e++) S[e] += counts[g] * row[e] / t;
      }
      let worst = 0;
      for (let e = 0; e < NEDU; e++) { f[e] = S[e] > 0 ? clamp(goal[e] / S[e], 0.05, 20) : 1; worst = Math.max(worst, Math.abs(S[e] - goal[e])); }
      if (worst < 1e-3 * n) break;
      for (const row of rows) {
        let t = 0; for (let e = 0; e < NEDU; e++) { row[e] = Math.max(1e-9, row[e] * f[e]); t += row[e]; }
        for (let e = 0; e < NEDU; e++) row[e] /= t;
      }
    }
    return rows;
  }

  /**
   * Each worker's job title, employer and wage draw (occupations.mjs), before their education: the title follows the
   * workplace, sex, age, shift and working from home; education then follows the title (eduBounds).
   */
  _titles(zi, core, hs) {
    const mem = core.members, out = new Array(mem.length).fill(null);
    for (let i = 0; i < mem.length; i++) {
      const p = mem[i];
      if (!p.worker) continue;
      const rng = new Rng(hash2(hs, i * 64 + KA.OCC));
      // a service member's branch is the installation's they report to (none off base: the place affinities decide)
      const branch = p.military ? this._branchOf(p, hs, i, zi, core.home) : null;
      const t = chooseTitle(rng, { group: p.military ? 'military' : p.occ, world: this.world, zi: p.workZi >= 0 ? p.workZi : zi, sex: p.sex, age: p.age, eduMax: eduBounds(p, null)[1], shift: p.shift || 'day', wfh: p.mode === 'wfh', branch });
      out[i] = { t, employer: t.employers[rng.int(t.employers.length)], uw: rng.float() };
    }
    return out;
  }

  // ---------------------------------------------------------------- layer 1: households and people

  /** Everything layer 1 knows about household h of ZIP zi (cached). */
  _detail(zi, h) {
    const key = zi * 67108864 + h;
    const hit = this._hhLru.get(key);
    if (hit) return hit;
    const w = this.world, F = this._full(zi), core = this.householdCore(zi, h), hs = this._hseed(zi, h), n = core.size, mem = core.members;
    const ori = this._origins(core, hs, F);
    const P = natPrep(core, ori, hs, kinship(mem)), N = natDecide(P, F.alpha, natResult(n)), kin = withoutSteps(P.kin, N);
    const titles = this._titles(zi, core, hs);
    const edu = eduDecide(core, hs, F.eduRows, titles);
    const L = langPrep(core, ori, N, edu, hs, F, P.by), LR = langDecide(L, F.lambda, F.kappa, langResult(n));
    const marital = maritalDecide(core, hs, F);
    const D = { zi, h, core, hs, ori, kin, N, edu, L, LR, marital, english: [], langs: [], veteran: [], status: [], occupation: [], income: [], names: [], birthYear: Array.from(P.by), birthplace: [] };
    for (let i = 0; i < n; i++) {
      const p = mem[i], home = LR.home[i];
      // English ability
      if (!home) { D.english.push('only'); D.langs.push(['english']); }
      else {
        const b = LANG_BUCKET_OF[home];
        const limited = L.k[i] > 0 && uni(hs, i, KA.LEP) < sigmoid(L.k[i] * F.delta[b] + L.x[i] + (LR.crossed[i] ? -2 : 0));
        D.english.push(limited ? 'limited' : 'very well');
        const list = [home];
        const o = ORIGINS[ori[i]];
        if (N.gen[i] === 1 && o.langs.length > 1 && uni(hs, i, KA.LIST) < 0.25) { const second = o.langs.find(l => l.key !== home); if (second) list.push(second.key); }
        // English is in the list of everyone who speaks it very well, of everyone born in the 50 states or who came here
        // before 13 (school was in English: limited is still learning it), and of most others
        const schooled = p.age >= 5 && (!N.out[i] || N.arr[i] - D.birthYear[i] < 13);
        if (!limited || schooled || uni(hs, i, KA.LIST + 64) < 0.7) list.push('english');
        D.langs.push(list);
      }
      D.veteran.push(!p.military && uni(hs, i, KA.VET) < vetRateAt(F, p));
      D.status.push(statusOf(p, core, hs, i, F));
    }
    // jobs and incomes: the household's income comes from its rank in the ZIP (B19001); pay stays near each job's
    // own range and the rest of the household's income is the householder's other income (savings, rent, help)
    const J = this._jobs(zi, core, titles, edu);
    D.occupation = J.occ;
    // a household ranked below a full year of its workers' pay at the minimum wage for their hours worked part of the
    // year (partYear: the weeks shrink, the hourly pay never falls below the minimum); only one ranked below even the
    // fewest weeks moves up to them
    const floor = incomeFloorMin(J);
    let Y = Math.max(this._householdIncome(F, incomeScore(J.pot, hs, floor)), floor);
    partYear(J, Y);
    Y = Math.max(Y, incomeFloor(J));
    const inc = allocateIncome(J, Y);
    if (!(sum(inc) > 0)) inc[0] = Y;
    const wages = Float64Array.from(inc, (v, i) => (J.occ[i] ? Math.max(J.minPay[i], Math.round(v / 100) * 100) : 0));
    const other = Math.max(0, Y - sum(inc));
    const sp = mem.findIndex(p => p.role === 'spouse');
    for (let i = 0; i < n; i++) {
      let v = J.occ[i] ? wages[i] : inc[i];
      if (i === 0) v += sp > 0 ? other / 2 : other;
      if (i === sp) v += other / 2;
      D.income.push(Math.round(v / 100) * 100);
      if (J.occ[i]) J.occ[i].wage = wages[i];
    }
    D.householdIncome = D.income.reduce((a, b) => a + b, 0);
    // each member's family language: the household's language for their origin, whether or not they speak it
    D.famLang = mem.map((_, i) => (L.choiceOf[i] >= 0 && L.choices[L.choiceOf[i]].pick ? L.choices[L.choiceOf[i]].pick.key : null));
    this._names(D);
    this._birthplaces(D);
    // a child whose birthplace (born abroad, come here with a parent) or family name came from the parent of the other
    // heritage carries both in the label, their own first (layer 0 gave them one parent's heritage)
    D.labels = mem.map((p, i) => {
      const own = ORIGINS[ori[i]];
      if ((p.role !== 'child' && p.role !== 'grandchild') || own.heritage === 'multiracial') return own.label;
      const other = [N.nat[i] ? N.from[i] : -1, D.line[i]].find(j => j >= 0 && j !== i && ORIGINS[ori[j]].heritage !== own.heritage);
      return other === undefined ? own.label : mixedLabel(own.label, ORIGINS[ori[other]].label);
    });
    this._dwellingYears(D);
    D.L = null;   // the language stage's inputs are not needed once English ability is known
    return this._hhLru.set(key, D);
  }

  /**
   * Each worker's job record and every member's earning power over a full year: a title's wage (by experience and
   * education, never below a full-time minimum-wage salary; a service member's federal pay) scaled by the hours
   * worked, never below the minimum wage for those hours (time and a half over 40); retirement income from 62.
   * minPay: the least each worker may be paid for their hours over the record's weeks (52 until partYear).
   */
  _jobs(zi, core, titles, edu) {
    const mem = core.members, n = mem.length, occ = new Array(n).fill(null), pot = new Float64Array(n), minPay = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = mem[i], T = titles[i];
      if (T) {
        const wage = titleWage(T.t, { world: this.world, zi: p.workZi >= 0 ? p.workZi : zi, age: p.age, education: eduLevel(edu[i]) }, T.uw);
        const hours = weeklyHours(p);
        minPay[i] = minPayFor(p, hours, 52);
        occ[i] = { key: T.t.key, title: T.t.title, sector: T.t.sector, employer: T.employer, shift: p.shift || T.t.shifts[0], wfh: p.mode === 'wfh', wage, hours, weeks: 52 };
        pot[i] = Math.max(wage * Math.min(1, hours / 38), minPay[i]);
      } else pot[i] = p.age >= 62 ? 24000 * Math.pow(EDU_WAGE[eduLevel(edu[i])], 0.8) : p.age >= 18 ? 3000 : 0;
    }
    return { occ, pot, minPay, mem };
  }

  _householdIncome(F, score) {
    const s = F.incScores;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid] < score) lo = mid + 1; else hi = mid; }
    const q = clamp((lo + 0.5) / (s.length + 1), 0.0005, 0.9995);
    return incomeAt(F.hincCum, q);
  }

  /**
   * Names (names.mjs) under each tradition's household customs. Everyone's own family name comes down their
   * father's line: the householder's is drawn; a spouse's, partner's or roommate's is their own; the householder's
   * parents and siblings share the householder's, and the spouse's parents and siblings living here (in-laws) the
   * spouse's; children take their father's (a single mother's own, except for some families whose children carry
   * their absent father's, the same for all her children; a child whose mother's husband here is not their father
   * always carries the absent father's); grandchildren take their own parent's (their father's when he lives here); a
   * son-in-law keeps his and a daughter-in-law marries into the family's. A married woman then carries her husband's
   * name, her own, or both, by her own tradition and generation (names.marriedSurname); spouses of a clan tradition
   * are of different clans and wives keep theirs (Hmong); where the custom is patronymic a child's surname is the
   * father's given name (Ethiopian, Eritrean); Sikh families carry Singh and Kaur (with the family's gotra, or as
   * surnames); an immigrant woman whose language marks it carries the feminine form of a surname from a line whose
   * language marks it too (Ivanova, never Martina). Names follow the family's language and origin (names.mjs
   * `language`, `origin`): a Punjabi-speaking Indian family is a Sikh family by the ZIP's odds. Children born abroad
   * who came with a parent carry names from that parent's country, and brothers and sisters are not given the same name.
   */
  _names(D) {
    const mem = D.core.members, n = mem.length, hs = D.hs, K = D.kin, N = D.N, F = this._full(D.zi), by = D.birthYear;
    const sRng = new Array(n), rS = i => sRng[i] || (sRng[i] = new Rng(hash2(hs, i * 64 + KA.NAME)));
    // whose names each member's follow: the heritage key names.mjs reads, the family's language for their origin, the
    // origin itself, and the generation (the Puerto Rico born grew up in Spanish, the Guam and Samoa born bilingual)
    const sikhFamily = uni(hs, 0, KA.SIKH) < F.pSikh;
    const nh = new Array(n), lang = new Array(n), orig = new Array(n), gen = new Uint8Array(n), cust = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = ORIGINS[D.ori[i]];
      lang[i] = D.famLang[i]; orig[i] = o.key;
      nh[i] = mem[i].heritage === 'indian' && lang[i] === 'punjabi' && sikhFamily ? 'sikh' : mem[i].heritage;
      gen[i] = N.out[i] && !N.nat[i] ? (o.terrNative ? 2 : 1) : N.gen[i];
      // a native of the 'other' race group is named like any Californian; one born abroad in their country's language
      if (nh[i] === 'other' && gen[i] !== 1) lang[i] = null;
      cust[i] = surnameCustoms(nh[i], { origin: orig[i], language: lang[i] });
    }
    const custom = i => cust[i];
    const sikh = i => nh[i] === 'sikh';
    const singhOnly = nh[0] === 'sikh' && uni(hs, 1, KA.CUSTOM) < 0.25;   // a Sikh family carrying Singh and Kaur as surnames
    const ownLine = i => surname(rS(i), nh[i], { language: lang[i], origin: orig[i] });
    const isM = i => i >= 0 && mem[i].sex === 'M', isF = i => i >= 0 && mem[i].sex === 'F';
    // the member a parent or sibling belongs with: the householder, or the spouse for in-laws
    const kid = i => (K.side[i] > 0 ? K.side[i] : 0);
    // the household's own customs: a father keeps the patronymic custom when he is an immigrant (and half the time
    // when born here); a mother's partner is her children's father in some families
    const patronymic = f => custom(f).patronymic && (gen[f] === 1 || uni(hs, f, KA.CUSTOM + 64) < 0.5);
    // a father in the 'parent' role whose given name is his child's surname (both of a patronymic tradition)
    const namesHead = i => mem[i].role === 'parent' && isM(i) && patronymic(i) && custom(kid(i)).patronymic;
    const partnerFather = uni(hs, 2, KA.CUSTOM) < 0.4;
    const fatherOf = i => {
      for (const j of [K.p1[i], K.p2[i]]) if (isM(j) && (mem[j].role !== 'partner' || partnerFather)) return j;
      return -1;
    };
    const motherOf = i => (isF(K.p1[i]) ? K.p1[i] : isF(K.p2[i]) ? K.p2[i] : -1);
    // a woman's husband living here: a mother in the 'parent' role is married to the father on her side (whether or not
    // he is listed as her child's), -2 when he does not live here
    const husbandOf = i => {
      if (!isF(i)) return -1;
      const role = mem[i].role;
      if (i === 0) { const s = mem.findIndex(p => p.role === 'spouse'); return isM(s) ? s : -1; }
      if (role === 'spouse') return isM(0) ? 0 : -1;
      if (role === 'relative' && K.inlaw[i] >= 0) return isM(K.inlaw[i]) ? K.inlaw[i] : -1;
      if (role === 'parent') { for (let j = 1; j < n; j++) if (mem[j].role === 'parent' && isM(j) && K.side[j] === K.side[i]) return j; return -2; }
      return -1;
    };

    // birth: the surname each was born with; line: the member whose family line it came down (that member's heritage,
    // origin and language decide
    // whether it has a feminine form)
    const birth = new Array(n).fill(null), line = new Int8Array(n).fill(-1), cur = new Array(n).fill(null), first = new Array(n).fill(null);
    const absent = new Map();   // a mother's children's absent father: {last, line (the member of his people), given}
    const absentFather = (m, i, need) => {
      const pat = custom(i).patronymic;
      if (!(pat || need || uni(hs, m, KA.CUSTOM + 128) < 0.25)) return null;
      if (absent.has(m)) return absent.get(m);
      // a child born abroad who came with their mother: her own people's name
      const s = N.nat[i] && N.from[i] === m ? m : i, r = new Rng(hash2(hs, m * 64 + KA.NAME + 16));
      const v = { last: surname(r, nh[s], { language: lang[s], origin: orig[s] }), line: s, given: null };
      if (pat) v.given = givenName(r, { heritage: nh[s], sex: 'M', birthYear: by[m] - 3, generation: gen[m], language: lang[s], origin: orig[s], surname: v.last }).split(' ')[0];
      absent.set(m, v);
      return v;
    };
    // the surname a child takes from a father: his own, or his given name where the custom is patronymic
    const paternal = f => (patronymic(f) ? givenOf(f).split(' ')[0] : currentOf(f));
    const birthOf = i => {
      if (birth[i] !== null) return birth[i];
      const role = mem[i].role;
      let v, ln = i;
      if (i === 0 || role === 'spouse' || role === 'partner' || role === 'roommate') {
        v = ownLine(i);
        // spouses of a clan tradition are of different clans
        if ((role === 'spouse' || role === 'partner') && custom(i).clan && custom(0).clan) for (let k = 0; k < 8 && v === birthOf(0); k++) v = ownLine(i);
        // and of one community where a heritage's families are of several (a Bangladeshi Muslim, Hindu or Buddhist family)
        if ((role === 'spouse' || role === 'partner') && nh[i] === nh[0]) for (let k = 0; k < 8 && !sameSurnameTradition(nh[i], v, birthOf(0)); k++) v = ownLine(i);
      } else if (role === 'parent') {
        // a father passes the family name down to his child here (his own father's given name where it is patronymic);
        // a mother was born into her own family
        const c = kid(i);
        if (isM(i) && !namesHead(i)) { v = birthOf(c); ln = line[c]; } else v = ownLine(i);
        // his given name is the family name where it is patronymic: his own surname is another; the mother of a clan
        // tradition was born into another clan
        if (isM(i) ? namesHead(i) : custom(i).clan && custom(c).clan) for (let k = 0; k < 8 && v === birthOf(c); k++) v = ownLine(i);
      } else if (role === 'sibling') { const c = kid(i); v = birthOf(c); ln = line[c]; }
      else if (role === 'child' || role === 'grandchild') {
        const f = fatherOf(i), m = motherOf(i);
        if (f >= 0) { v = paternal(f); ln = patronymic(f) ? f : line[f]; }
        else if (m >= 0) {
          // a mother's husband living here who is not the child's father (a stepfather): the child has their own father's name
          const a = absentFather(m, i, N.step[i] >= 0 || husbandOf(m) >= 0);
          if (a) { v = a.given || a.last; ln = a.line; } else { v = currentOf(m); ln = line[m]; }
        } else { v = birthOf(0); ln = line[0]; }
      } else if (K.inlaw[i] >= 0) {
        v = ownLine(i);
        if (custom(i).clan && custom(K.inlaw[i]).clan) for (let k = 0; k < 8 && v === birthOf(K.inlaw[i]); k++) v = ownLine(i);
      } else if (rS(i).float() < 0.35) { v = birthOf(0); ln = line[0]; }
      else v = ownLine(i);
      line[i] = ln;
      return (birth[i] = v);
    };
    // the feminine form an immigrant woman whose language marks it carries of a surname whose line's language does too
    // (the line's heritage, or its origin or language: an Uzbek family's Karimova, a Czech family's Novakova)
    const fem = (i, name, ln) => {
      if (!(gen[i] === 1 && isF(i) && custom(i).feminine && ln >= 0)) return name;
      const o = { origin: orig[ln], language: lang[ln] };
      return surnameCustoms(nh[ln], o).feminine ? adaptSurname(name, { heritage: nh[ln], sex: 'F', ...o }) : name;
    };
    function currentOf(i) {
      if (cur[i] !== null) return cur[i];
      const b = birthOf(i);
      let v = b;
      if (sikh(i) && singhOnly && (mem[i].role === 'spouse' || mem[i].role === 'partner' || !(fatherOf(i) >= 0 && !sikh(fatherOf(i))))) v = isM(i) ? 'Singh' : 'Kaur';
      else if (isF(i)) {
        const h = husbandOf(i), r = rS(i);
        // the husband's surname: his own, or (a mother whose husband is not here) the family's, which he passed down
        let his = null, hisLine = -1;
        if (h >= 0) { his = currentOf(h); hisLine = line[h]; }
        else if (h === -2 && !custom(i).patronymic) { const c = kid(i); his = birthOf(c); hisLine = line[c]; }
        if (his !== null) v = marriedSurname(r, { heritage: nh[i], origin: orig[i], generation: gen[i], own: fem(i, b, line[i]), husband: fem(i, his, hisLine) });
        else if (mem[i].role === 'sibling' && mem[i].age >= 25 && r.float() < 0.3 * (1 - custom(i).wife.keep[gen[i] === 1 ? 0 : 1])) v = ownLine(i);
        else v = fem(i, b, line[i]);
        if (sikh(i) && mem[i].age >= 18 && r.float() < 0.15) v = 'Kaur';
      }
      return (cur[i] = v);
    }
    function givenOf(i) {
      if (first[i] !== null) return first[i];
      // under a patronymic custom a father's given name is his child's surname
      if (namesHead(i)) return (first[i] = birthOf(kid(i)));
      // a child born abroad who came here with a parent was named in that parent's country
      const c = N.nat[i] && N.from[i] >= 0 ? N.from[i] : i;
      const parents = [K.p1[i], K.p2[i]].filter(j => j >= 0).map(j => mem[j].heritage);
      const r = new Rng(hash2(hs, i * 64 + KA.NAME + 32));
      const opts = {
        heritage: nh[c], language: lang[c], origin: orig[c], sex: mem[i].sex, birthYear: by[i], generation: c !== i ? 1 : gen[i],
        nativity: N.nat[i] ? 'foreign' : 'native', surname: currentOf(i), birthSurname: birthOf(i), parents,
        arrivalAge: N.nat[i] ? N.arr[i] - by[i] : undefined,
      };
      let g = givenName(r, opts);
      // brothers and sisters (the householder's children, or grandchildren) are not given the same name
      const role = mem[i].role;
      if (role === 'child' || role === 'grandchild') {
        const taken = new Set();
        for (let j = 0; j < i; j++) if (mem[j].role === role) taken.add(givenOf(j).split(' ')[0]);
        for (let t = 0; t < 8 && taken.has(g.split(' ')[0]); t++) g = givenName(r, opts);
      }
      return (first[i] = g);
    }
    D.names = mem.map((p, i) => {
      const f = givenOf(i), last = currentOf(i);
      birthOf(i);
      const nick = nickname(new Rng(hash2(hs, i * 64 + KA.NAME + 48)), f, { heritage: nh[i], age: p.age, sex: p.sex, surname: last }) || null;
      return { first: f, last, full: `${f} ${last}`, display: `${nick || f} ${last}`, nick };
    });
    D.line = line;
  }

  /**
   * Where each member was born: abroad (the origin's places, those of the family's language first), a territory,
   * elsewhere in California or another state. A child born abroad who came here with a parent was born in that
   * parent's country (or Mexican state), and brothers and sisters mostly in the same town, often the parent's own
   * hometown. Nobody is born in a place that did not exist that year: a refugee camp outside its years, a wartime
   * town (their names carry the years, and the draw falls back to the origin's other places).
   */
  _birthplaces(D) {
    const w = this.world, z = w.zip(D.zi), mem = D.core.members, hs = D.hs, N = D.N, n = mem.length, by = D.birthYear;
    const out = new Array(n).fill(null), town = new Map();
    const langOf = i => D.famLang[i] || D.LR.home[i] || (ORIGINS[D.ori[i]].langs[0] && ORIGINS[D.ori[i]].langs[0].key) || null;
    const saigon = (place, i) => place.replace(/^(Saigon|Ho Chi Minh City),/, by[i] > 1976 ? 'Ho Chi Minh City,' : 'Saigon,');
    const latino = ORIGINS[ORIGIN_INDEX.latino].places;
    // the places a member born outside the 50 states could be from: their origin's, else (no foreign places) those of
    // a member of the household born outside them the same way
    const placesOf = (i, list) => {
      if (ORIGINS[D.ori[i]][list].length) return ORIGINS[D.ori[i]][list];
      for (let j = 0; j < n; j++) if (j !== i && N.out[j] && N.nat[j] === N.nat[i] && ORIGINS[D.ori[j]][list].length) return ORIGINS[D.ori[j]][list];
      return null;
    };
    const placeOf = i => {
      if (out[i] !== null) return out[i];
      const p = mem[i], o = ORIGINS[D.ori[i]], u = uni(hs, i, KA.BORN), u2 = uni(hs, i, KA.BORN2);
      let v;
      // (only a parent born outside the 50 states the same way: an immigrant whose mother was born in American Samoa was
      // born abroad in their own country, never in her territory, which would make them native born)
      const c = N.out[i] && N.from[i] >= 0 && N.nat[N.from[i]] === N.nat[i] ? N.from[i] : -1;
      if (c >= 0) {
        // born where the parent they came with lived: the family's town (often the parent's own hometown), else a
        // place of the parent's own country that existed that year
        const all = placesOf(c, N.nat[c] ? 'places' : 'territoryPlaces') || latino, lang = N.nat[c] ? langOf(c) : null;
        const home = placeOf(c), near = all.filter(pl => regionOf(pl.name) === regionOf(home));
        if (!town.has(c)) town.set(c, uni(hs, c, KA.TOWN) < 0.6 ? home : pickBirthplace([near, all], uni(hs, c, KA.TOWN + 64), lang, by[i]));
        const t = town.get(c);
        v = uni(hs, i, KA.TOWN) < 0.85 && placeExisted(t, by[i]) ? t : pickBirthplace([near, all], u, lang, by[i]);
        if (N.nat[i]) v = saigon(v, i);
      } else if (N.nat[i]) {
        v = saigon(pickBirthplace([placesOf(i, 'places'), latino], u, langOf(i), by[i]), i);
      } else if (N.out[i] && placesOf(i, 'territoryPlaces')) {
        v = pickBirthplace([placesOf(i, 'territoryPlaces')], u, null, by[i]);
      } else {
        // US-born: California for most, the more so for children, the children of immigrants and California's tribes
        const inCA = o.inCA || (p.age < 18 ? 0.92 : N.gen[i] === 2 ? 0.85 : p.age < 35 ? 0.72 : p.age < 65 ? 0.6 : 0.48);
        if (u < inCA) {
          const local = p.age < 18 ? 0.75 : 0.55;
          if (u2 < local) v = `${z.city}, California`;
          else {
            const x = (u2 - local) / (1 - local);
            v = null;
            if (x < 0.55) {
              const near = w.placesNear(D.core.home.x, D.core.home.y, 80).filter(q => q.pop >= 2000 && !q.cdp);
              if (near.length) { let s = 0; const cum = Float64Array.from(near, q => (s += q.pop)); v = `${pickCum({ names: near.map(q => q.name), cum }, x / 0.55)}, California`; }
            }
            if (v === null) v = `${pickCum(this._caPlaces(), x)}, California`;
          }
        } else {
          const boost = o.usBoost || (p.heritage === 'african-american' && p.age >= 50 ? GREAT_MIGRATION : null);
          v = pickPlace(US_STATES, u2, null, boost);
        }
      }
      return (out[i] = v);
    };
    for (let i = 0; i < n; i++) placeOf(i);
    D.birthplace = out;
  }

  /** California places by population, for natives born elsewhere in the state. */
  _caPlaces() {
    if (this._caPlaceCum) return this._caPlaceCum;
    const pl = this.world.places.filter(p => p.pop >= 5000 && !p.cdp);
    let c = 0;
    this._caPlaceCum = { names: pl.map(p => p.name), cum: Float64Array.from(pl, p => (c += p.pop)) };
    return this._caPlaceCum;
  }

  /**
   * When the household's home was built and when the household moved in. Around the ZIP's median year built
   * (yb_med); where that is the Census top code (built 1939 or earlier: world.zip ybBefore1940, the pack's 1938) at
   * least half the homes are from before 1940, the turn of the century to the thirties, and the rest from the forties on.
   */
  _dwellingYears(D) {
    const z = this.world.z, zi = D.zi, core = D.core, hs = D.hs;
    const yb = z.yb_med[zi] || this._col(zi, 'yb_med', 1975), wz = this.world.zip(zi);
    let built = Math.round(yb + 14 * gaussOf(hs, 90, KA.BUILT));
    if ((wz && wz.ybBefore1940 === true) || yb <= 1939) {
      built = uni(hs, 90, KA.OLD) < 0.62 && core.dwelling !== 'mobile-home'
        ? clamp(Math.round(1912 + 12 * gaussOf(hs, 90, KA.BUILT)), 1880, 1939)
        : clamp(1940 + Math.round(-16 * Math.log(Math.max(1e-6, uni(hs, 92, KA.OLD)))), 1940, YEAR - 1);
    }
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
    const D = this._detail(zi, h);
    if (D.view) return D.view;
    const c = D.core, ll = this.world.unproject(c.home.x, c.home.y);
    return (D.view = {
      id: c.id, zi, h, zip: this.world.zips[zi], size: c.size, type: c.type, tenure: c.tenure, dwelling: c.dwelling, vehicles: c.vehicles,
      heritage: c.heritage, income: D.householdIncome, yearMoved: D.yearMoved, yearBuilt: D.yearBuilt,
      home: { x: c.home.x, y: c.home.y, lat: +ll.lat.toFixed(5), lon: +ll.lon.toFixed(5) },
      members: c.members.map((p, i) => ({ m: p.m, role: p.role, name: D.names[i].display, first: D.names[i].first, age: p.age, sex: p.sex })),
    });
  }

  /** The place record shared by a ZIP's NPCs. */
  _place(zi) {
    const F = this._full(zi);
    if (F.place) return F.place;
    const z = this.world.zip(zi);
    // neighborhood: inside the biggest cities, the name residents use for the part of the city the ZIP covers ('the
    // Mission', 'Boyle Heights'; world.zip), else null; where someone lives is `neighborhood || place || city`
    return (F.place = { zip: z.zip, city: z.city, place: z.placeName, neighborhood: z.neighborhood || null, countyName: z.countyName, countyFips: z.countyFips, region: z.regionKey, regionName: z.regionName, province: z.provinceName, zone: z.zoneTitle });
  }

  /**
   * Layer 1 person: the full NPC record of CONTRACTS section 5 (consistent with householdCore member m).
   * Extra fields: origin (a finer heritage key, e.g. 'taiwanese'); mainlandYear (for someone born in Puerto Rico,
   * Guam or American Samoa: native born, generation 3, so arrivalYear is null; the year they moved to the
   * mainland); occupation.hours (paid hours a week: occupation.wage is the year's pay for them, never below the
   * minimum wage); commute.workDays (layer 0's work or school days); commute.road for drivers (a world.roadsNear
   * record); household.members[].first; parents, the member indices of the person's parents who live in the household
   * (a child of the householder: the householder and the spouse or partner when old enough to be a parent; a
   * grandchild: the householder's child who is their parent, and that child's spouse when they live here too; the
   * householder and siblings: the members in the 'parent' role), mother first.
   * @param {number} zi ZIP index
   * @param {number} h household index
   * @param {number} m member index
   * @returns {object|null} the NPC, or null when the household has no member m
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
      race: RACES[H_GROUP[H_INDEX[p.heritage]]], heritage: p.heritage, heritageLabel: D.labels[m], origin: o.key,
      nativity: D.N.nat[m] ? 'foreign' : 'native', generation: D.N.gen[m], arrivalYear: D.N.nat[m] ? D.N.arr[m] : null, birthplace: D.birthplace[m],
      mainlandYear: !D.N.nat[m] && D.N.out[m] ? D.N.arr[m] : null,
      name: { ...D.names[m] },
      languages: { home: D.LR.home[m] || 'english', english: D.english[m], list: D.langs[m].slice() },
      education: edu >= 0 ? EDUCATION_KEYS[edu] : edu === -2 ? 'in school' : 'child',
      school: schoolOf(p),
      status: D.status[m],
      occupation: D.occupation[m] ? { ...D.occupation[m] } : null,
      income: D.income[m], householdIncome: D.householdIncome,
      commute: {
        mode: p.mode, minutes: p.commuteMin, departMin: p.departMin, dwellMin: p.dwellMin, days: p.days, workDays: p.workDays,
        workZi: p.workZi, workZip: p.workZi >= 0 ? w.zips[p.workZi] : null, workCity: p.workZi >= 0 ? w.z.city[p.workZi] : null,
        work: p.work ? { x: p.work.x, y: p.work.y } : null, road: this._roadFor(c, p),
      },
      marital: MARITAL[D.marital[m]], veteran: D.veteran[m],
      parents: [D.kin.p1[m], D.kin.p2[m]].filter(j => j >= 0),
      household: { id: c.id, size: c.size, type: c.type, tenure: c.tenure, dwelling: c.dwelling, vehicles: c.vehicles, yearMoved: D.yearMoved, yearBuilt: D.yearBuilt, home: hh.home, members: hh.members },
      place: this._place(zi),
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
   * n distinct NPCs of ZIP zi, uniform over its persons (households drawn in proportion to their size): all of them
   * when the ZIP has n or fewer. The same (zi, seed) gives the same sequence; a smaller n is a prefix of a larger one.
   */
  sample(zi, n, seed = 1) {
    const H = this.householdCount(zi), out = [];
    if (!H || !(n > 0)) return out;
    const M = this._core(zi), r = new Rng(hash3(this.seed ^ 0x5a3e, zi, seed)), seen = new Set();
    // at least H people live in H households, so only a ZIP with fewer households than n needs its people counted
    const cap = H >= n ? n : Math.min(n, this._personsIn(zi));
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
    if (!this._stateTable) this._stateTable = new Table(Float64Array.from({ length: w.N }, (_, i) => this.expectedPersons(i)));
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
        // B21001 counts civilians: active-duty members are in neither of its columns
        if (p.age >= 18 && !p.military) inc('vet', `${sx}_${D.veteran[i] ? 'vet' : 'non'}${p.age < 35 ? '18-34' : p.age < 55 ? '35-54' : p.age < 65 ? '55-64' : p.age < 75 ? '65-74' : '75+'}`);
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
    // marital status and veterans of the household population (the group-quarters residents out of B12001 and B21001)
    const hc = this._hhCensus(zi), ml = w.acsLabels('mar'), vl = w.acsLabels('vet'), mo = {}, vo = {};
    ml.forEach((k, j) => { mo['m_' + k] = hc.mar[j]; mo['f_' + k] = hc.mar[ml.length + j]; });
    vl.forEach((k, j) => { vo['m_vet' + k] = hc.vet[j]; vo['m_non' + k] = hc.vet[5 + j]; vo['f_vet' + k] = hc.vet[10 + j]; vo['f_non' + k] = hc.vet[15 + j]; });
    target.mar = norm(mo); target.vet = norm(vo);
    target.emp = norm(Object.fromEntries(w.acsLabels('emp').map((k, j) => [k, hc.emp[j]])));
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
