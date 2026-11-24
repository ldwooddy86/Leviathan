// Legion · population — PROVISIONAL STUB.
//
// This file holds the contract API of docs/CONTRACTS.md §5 with a deliberately simple generator so other
// modules can be built and tested against it. The population module owner replaces it entirely with the
// calibrated generator (same exports, same shapes). Do not build on anything here that the contract does not
// promise.

import { Rng, hash2, hash3, u01, Alias, clamp } from './rng.mjs';

export const LEGION_SEED = 1849;
const MODES = ['drive', 'carpool', 'bus', 'rail', 'ferry', 'taxi', 'motorcycle', 'bike', 'walk', 'other', 'wfh'];
const AGE_LO = [0, 5, 10, 15, 18, 20, 21, 22, 25, 30, 35, 40, 45, 50, 55, 60, 62, 65, 67, 70, 75, 80, 85];
const AGE_HI = [4, 9, 14, 17, 19, 20, 21, 24, 29, 34, 39, 44, 49, 54, 59, 61, 64, 66, 69, 74, 79, 84, 95];

/** Parse "94110-123-0" (or "94110-123") into {zip, h, m}; zi is filled in by Population.get. */
export function parseId(id) {
  const m = /^(\d{5})-(\d+)(?:-(\d+))?$/.exec(String(id || '').trim());
  return m ? { zip: m[1], h: +m[2], m: m[3] === undefined ? null : +m[3] } : null;
}

export class Population {
  constructor(world, { seed = LEGION_SEED } = {}) {
    this.world = world;
    this.seed = seed >>> 0;
    this._zipCache = new Array(world.N);
    this._lru = new Map();
  }

  householdCount(zi) { return this.world.z.hh[zi] || 0; }

  _zipModel(zi) {
    let m = this._zipCache[zi];
    if (m) return m;
    const w = this.world;
    const age = w.acs(zi, 'age');
    const comm = w.acs(zi, 'comm'), occ = w.acs(zi, 'occ'), emp = w.acs(zi, 'emp'), hht = w.acs(zi, 'hht');
    const adults = age.map((v, k) => (k % 23) >= 4 ? v : 0);
    const kids = age.map((v, k) => (k % 23) < 4 ? v : 0);
    const pop16 = emp.reduce((a, b) => a + b, 0) || 1;
    const nearby = w.zipsNear(w.z.tx[zi], w.z.ty[zi], 45).filter(([j]) => (w.z.est[j] || 0) > 0);
    m = {
      adult: new Alias(adults), kid: new Alias(kids), all: new Alias(age),
      hht: new Alias(hht.some(v => v > 0) ? hht : [1, 0, 0, 1, 0]),
      mode: new Alias(comm.some(v => v > 0) ? comm : [1]),
      occM: new Alias(occ.slice(0, 25)), occF: new Alias(occ.slice(25)),
      pWork: clamp((emp[0] + emp[2]) / pop16, 0.05, 0.95),
      size: Math.max(1, (w.z.hhsize[zi] || 2.5)),
      work: nearby.length ? { list: nearby.map(n => n[0]), dist: nearby.map(n => n[1]), alias: new Alias(nearby.map(([j, d]) => (w.z.est[j] || 1) * Math.exp(-d / 12))) } : null,
    };
    this._zipCache[zi] = m;
    return m;
  }

  /** Persons in household h of ZIP zi (O(1)). */
  householdSize(zi, h) {
    const m = this._zipModel(zi), r = new Rng(hash3(this.seed, zi, h));
    const type = m.hht.draw(r);
    if (type === 3) return 1;
    const extra = Math.max(0, m.size - 1.6);
    let k = 0; const L = Math.exp(-extra); let p = 1;
    do { k++; p *= r.float(); } while (p > L && k < 12);
    return clamp(1 + k, 2, 12);
  }

  /** Deterministic household sample for the crowd. */
  includes(zi, h, rate) { return u01(hash3(this.seed ^ 0xC0, zi, h)) < rate; }

  /** Layer 0 household (see CONTRACTS §5). */
  householdCore(zi, h) {
    const w = this.world, m = this._zipModel(zi), r = new Rng(hash3(this.seed, zi, h));
    const typeIdx = m.hht.draw(r);
    const type = ['married', 'father', 'mother', 'alone', 'roommates'][typeIdx];
    const size = this.householdSize(zi, h);
    const own = r.float() * 100 < (w.z.own_sh[zi] || 50);
    const home = w.homeFor(zi, h);
    const members = [];
    for (let k = 0; k < size; k++) {
      const pr = new Rng(hash3(this.seed ^ 0x5157, zi, h * 16 + k));
      const role = k === 0 ? 'householder' : (type === 'married' && k === 1 ? 'spouse' : (type === 'roommates' ? 'roommate' : 'child'));
      const bucket = role === 'child' ? m.kid.draw(pr) : m.adult.draw(pr);
      const sexIdx = Math.floor(bucket / 23), b = bucket % 23;
      const age = AGE_LO[b] + pr.int(AGE_HI[b] - AGE_LO[b] + 1);
      const sex = role === 'spouse' ? (members[0].sex === 'F' ? 'M' : 'F') : (type === 'father' && k === 0 ? 'M' : type === 'mother' && k === 0 ? 'F' : (sexIdx ? 'F' : 'M'));
      const worker = age >= 16 && age < 75 && pr.float() < m.pWork * (age > 64 ? 0.35 : 1.1);
      let mode = null, commuteMin = 0, departMin = null, dwellMin = 0, workZi = -1, work = null, occ = null, student = null;
      if (worker) {
        mode = MODES[m.mode.draw(pr)];
        occ = w.acsLabels('occ')[(sex === 'M' ? m.occM : m.occF).draw(pr)];
        if (mode !== 'wfh') {
          commuteMin = 10 + pr.int(40);
          departMin = 360 + pr.int(180);
          dwellMin = 480 + pr.int(90);
          if (m.work) { const j = m.work.alias.draw(pr); workZi = m.work.list[j]; work = w.homeFor(workZi, 0x40000 + (hash2(zi, h * 16 + k) & 0xffff)); }
        }
      } else if (age >= 5 && age < 18) {
        student = 'k12'; mode = pr.chance(0.4) ? 'walk' : 'carpool'; commuteMin = 5 + pr.int(15); departMin = 460 + pr.int(30); dwellMin = 400;
        workZi = zi; work = w.homeFor(zi, 0x50000 + (h % 50));
      }
      members.push({ m: k, role, sex, age, heritage: 'other', worker, military: false, occ, student, mode, commuteMin, departMin, dwellMin, days: 62, workZi, work });
    }
    return { zi, h, id: `${w.zips[zi]}-${h}`, size, type, tenure: own ? 'own' : 'rent', dwelling: own ? 'house' : 'apartment', vehicles: own ? 2 : 1, home, heritage: 'other', members };
  }

  /** Layer 1 household (stub: the core plus placeholders). */
  household(zi, h) {
    const c = this.householdCore(zi, h), w = this.world;
    const ll = w.unproject(c.home.x, c.home.y);
    return Object.assign({}, c, { income: w.z.inc[zi] || 0, yearMoved: 2015, yearBuilt: w.z.yb_med[zi] || 1975, home: { x: c.home.x, y: c.home.y, lat: ll.lat, lon: ll.lon } });
  }

  /** Layer 1 person (stub). */
  person(zi, h, m) {
    const key = `${zi}:${h}:${m}`;
    if (this._lru.has(key)) return this._lru.get(key);
    const w = this.world, hh = this.household(zi, h), pc = hh.members[m];
    if (!pc) return null;
    const z = w.zip(zi);
    const npc = {
      id: `${z.zip}-${h}-${m}`, hid: hh.id, zip: z.zip, zi, h, m,
      role: pc.role, sex: pc.sex, age: pc.age, birthYear: 2026 - pc.age, pronouns: pc.sex === 'F' ? 'she/her' : 'he/him',
      race: 'other', heritage: 'other', heritageLabel: 'Californian', nativity: 'native', generation: 3, arrivalYear: null, birthplace: `${z.city}, California`,
      name: { first: pc.sex === 'F' ? 'Alex' : 'Sam', last: 'Rivera', full: 'Placeholder Rivera', display: (pc.sex === 'F' ? 'Alex' : 'Sam') + ' Rivera', nick: null },
      languages: { home: 'english', english: 'only', list: ['english'] },
      education: pc.age >= 25 ? 'hs' : 'child', school: pc.student ? 'high' : null,
      status: pc.worker ? 'employed' : (pc.age < 18 ? 'child' : (pc.age >= 65 ? 'retired' : 'not working')),
      occupation: pc.occ ? { key: pc.occ, title: pc.occ, sector: pc.occ, employer: 'a local employer', shift: 'day', wfh: pc.mode === 'wfh', wage: 50000 } : null,
      income: pc.worker ? 50000 : 0, householdIncome: hh.income,
      commute: { mode: pc.mode, minutes: pc.commuteMin, departMin: pc.departMin, dwellMin: pc.dwellMin, days: pc.days, workZi: pc.workZi, workZip: pc.workZi >= 0 ? w.zips[pc.workZi] : null, workCity: pc.workZi >= 0 ? w.z.city[pc.workZi] : null, work: pc.work, road: null },
      marital: pc.role === 'spouse' || (pc.role === 'householder' && hh.type === 'married') ? 'married' : 'never', veteran: false,
      household: { id: hh.id, size: hh.size, type: hh.type, tenure: hh.tenure, dwelling: hh.dwelling, vehicles: hh.vehicles, yearMoved: hh.yearMoved, yearBuilt: hh.yearBuilt, home: hh.home, members: hh.members.map(x => ({ m: x.m, role: x.role, name: x.sex === 'F' ? 'Alex' : 'Sam', age: x.age, sex: x.sex })) },
      place: { zip: z.zip, city: z.city, place: z.placeName, countyName: z.countyName, countyFips: z.countyFips, region: z.regionKey, regionName: z.regionName, province: z.provinceName, zone: z.zoneTitle },
      seed: hash3(this.seed ^ 0x9e75, zi, h * 16 + m),
    };
    if (this._lru.size > 20000) this._lru.clear();
    this._lru.set(key, npc);
    return npc;
  }

  get(id) {
    const p = parseId(id); if (!p) return null;
    const zi = this.world.indexOf(p.zip); if (zi < 0 || p.h >= this.householdCount(zi)) return null;
    return this.person(zi, p.h, p.m || 0);
  }

  members(zi, h) { return this.householdCore(zi, h).members.map((_, m) => this.person(zi, h, m)); }

  sample(zi, n, seed = 1) {
    const r = new Rng(hash3(this.seed, zi, seed)), out = [], seen = new Set(), H = this.householdCount(zi);
    for (let t = 0; out.length < n && t < n * 20 && H > 0; t++) {
      const h = r.int(H), size = this.householdSize(zi, h);
      if (r.float() > size / 12) continue;
      const m = r.int(size), key = h * 16 + m;
      if (seen.has(key)) continue; seen.add(key); out.push(this.person(zi, h, m));
    }
    return out;
  }

  sampleState(n, seed = 1) {
    const w = this.world, a = new Alias(w.z.pop), r = new Rng(hash2(this.seed, seed)), out = [];
    for (let k = 0; k < n; k++) { const zi = a.draw(r); out.push(...this.sample(zi, 1, seed * 7919 + k)); }
    return out;
  }

  validate() { return { generated: {}, acs: {}, stub: true }; }
}
