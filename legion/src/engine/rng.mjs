// Legion · deterministic randomness.
//
// Every NPC in Legion is a pure function of (world pack, ZIP, household, member, seed). Nothing is stored:
// the same id always produces the same person, in the browser and in Node. That rests on this file: integer
// hashes for addressing (hash2, hash3) and a small seeded generator (Rng) for drawing within one entity.
//
// Hashing: lowbias32 (Chris Wellons, public domain), an avalanche-tested 32 bit integer mixer.
// Generator: sfc32 (Chris Doty-Humphrey's small fast counter, public domain), seeded through splitmix32.

export const GOLDEN = 0x9e3779b9;

/** Mix one 32 bit integer. */
export function mix32(x) {
  x = x >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Hash two integers to a uint32. */
export function hash2(a, b) {
  return mix32((mix32(a) + Math.imul(b | 0, GOLDEN) + 0x632be5ab) >>> 0);
}

/** Hash three integers to a uint32. */
export function hash3(a, b, c) {
  return mix32((hash2(a, b) ^ Math.imul((c | 0) + 0x5bd1e995, 0x27d4eb2d)) >>> 0);
}

/** Hash a string (FNV-1a over UTF-16 code units, then mixed) to a uint32. */
export function hashStr(s, seed = 0) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return mix32(h);
}

/** Hash any mix of numbers and strings to a uint32. */
export function hashAll(...parts) {
  let h = 0x2545f491;
  for (const p of parts) h = hash2(h, typeof p === 'number' ? (p | 0) ^ Math.floor(p / 4294967296) : hashStr(p));
  return h >>> 0;
}

/** A uint32 as a float in [0, 1). */
export const u01 = h => (h >>> 0) / 4294967296;

/** Seeded generator. Deterministic, fast, and forkable by label. */
export class Rng {
  constructor(seed = 1) {
    // splitmix32 to spread the seed over the four words
    let s = (seed >>> 0) || 0x1234567;
    const sm = () => { s = (s + 0x9e3779b9) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
    this.a = sm(); this.b = sm(); this.c = sm(); this.d = sm();
    this.seed = seed >>> 0;
    this._gauss = null;
    for (let i = 0; i < 12; i++) this.next();
  }
  /** Next uint32. */
  next() {
    let { a, b, c, d } = this;
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t >>> 0;
  }
  /** Float in [0, 1). */
  float() { return this.next() / 4294967296; }
  /** Integer in [0, n). */
  int(n) { return n <= 0 ? 0 : Math.floor(this.float() * n); }
  /** Integer in [lo, hi] inclusive. */
  range(lo, hi) { return lo + this.int(hi - lo + 1); }
  /** Float in [lo, hi). */
  uniform(lo, hi) { return lo + (hi - lo) * this.float(); }
  /** True with probability p. */
  chance(p) { return this.float() < p; }
  /** One element of an array (undefined for an empty one). */
  pick(arr) { return arr && arr.length ? arr[this.int(arr.length)] : undefined; }
  /** Index drawn in proportion to non-negative weights; -1 when they sum to zero. */
  weighted(weights) {
    let tot = 0;
    for (let i = 0; i < weights.length; i++) tot += weights[i] > 0 ? weights[i] : 0;
    if (!(tot > 0)) return -1;
    let u = this.float() * tot;
    for (let i = 0; i < weights.length; i++) { const w = weights[i] > 0 ? weights[i] : 0; if (u < w) return i; u -= w; }
    for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
    return -1;
  }
  /** Key of an object of weights, drawn in proportion. */
  weightedKey(obj) {
    const keys = Object.keys(obj);
    const i = this.weighted(keys.map(k => obj[k]));
    return i < 0 ? undefined : keys[i];
  }
  /** Element of items drawn by weightFn(item). */
  weightedItem(items, weightFn) {
    const i = this.weighted(items.map(weightFn));
    return i < 0 ? undefined : items[i];
  }
  /** Standard normal draw (Box-Muller, cached pair). */
  gauss() {
    if (this._gauss !== null) { const g = this._gauss; this._gauss = null; return g; }
    let u = 0, v = 0;
    while (u <= 1e-12) u = this.float();
    v = this.float();
    const r = Math.sqrt(-2 * Math.log(u));
    this._gauss = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
  normal(mu = 0, sd = 1) { return mu + sd * this.gauss(); }
  /** Normal clamped to [lo, hi]. */
  clampedNormal(mu, sd, lo, hi) { return Math.min(hi, Math.max(lo, this.normal(mu, sd))); }
  lognormal(mu, sigma) { return Math.exp(mu + sigma * this.gauss()); }
  /** Fisher-Yates in place; returns the array. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  /** k distinct elements (k <= length). */
  sample(arr, k) {
    const a = arr.slice();
    k = Math.min(k, a.length);
    for (let i = 0; i < k; i++) { const j = i + this.int(a.length - i); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, k);
  }
  /** A new generator whose stream depends on this one's seed and a label, not on how far this one has run. */
  fork(label) { return new Rng(hash2(this.seed, typeof label === 'number' ? label : hashStr(label))); }
}

/** Vose alias table: O(1) draws from a fixed discrete distribution. */
export class Alias {
  constructor(weights) {
    const n = weights.length;
    this.n = n;
    this.prob = new Float64Array(n);
    this.alias = new Int32Array(n);
    let tot = 0;
    for (let i = 0; i < n; i++) tot += weights[i] > 0 ? weights[i] : 0;
    this.total = tot;
    if (!(tot > 0)) { this.prob.fill(1); for (let i = 0; i < n; i++) this.alias[i] = i; this.empty = true; return; }
    const scaled = new Float64Array(n);
    const small = [], large = [];
    for (let i = 0; i < n; i++) { scaled[i] = (weights[i] > 0 ? weights[i] : 0) * n / tot; (scaled[i] < 1 ? small : large).push(i); }
    while (small.length && large.length) {
      const s = small.pop(), l = large.pop();
      this.prob[s] = scaled[s]; this.alias[s] = l;
      scaled[l] = scaled[l] + scaled[s] - 1;
      (scaled[l] < 1 ? small : large).push(l);
    }
    while (large.length) { const l = large.pop(); this.prob[l] = 1; this.alias[l] = l; }
    while (small.length) { const s = small.pop(); this.prob[s] = 1; this.alias[s] = s; }
  }
  /** Draw with two uniforms in [0,1) (or one Rng). */
  draw(u1, u2) {
    if (typeof u1 === 'object') { const r = u1; u1 = r.float(); u2 = r.float(); }
    const i = Math.min(this.n - 1, Math.floor(u1 * this.n));
    return u2 < this.prob[i] ? i : this.alias[i];
  }
}

/** Cumulative sums of weights (Float64Array), for binary-search draws. */
export function cumulative(weights) {
  const c = new Float64Array(weights.length);
  let t = 0;
  for (let i = 0; i < weights.length; i++) { t += weights[i] > 0 ? weights[i] : 0; c[i] = t; }
  return c;
}

/** Index i with cum[i-1] <= u*total < cum[i]. */
export function drawCumulative(cum, u) {
  const total = cum[cum.length - 1];
  const x = u * total;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (cum[mid] > x) hi = mid; else lo = mid + 1; }
  return lo;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
