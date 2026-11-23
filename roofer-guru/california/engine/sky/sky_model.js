  /* ==== sky job: the air traffic model. No drawing here: where every aircraft is at a given moment, worked from the clock ==== */
  /* What is real, and what is made up.
     REAL (from the evidence file SP/research/ca/engine_evidence.md, section B, and the saved tables):
       - the runways: both ends, elevations and displaced thresholds of the fifteen named airports (OurAirports, the
         California extract of 18 Nov 2026);
       - which runways land and which take off: LAX west flow, arrivals on the outer pair 24R and 25L, departures on the
         inner pair 24L and 25R, and over the ocean from midnight to 6:30 a.m. (LAWA; FAA capacity profile); SFO arrivals
         in pairs to 28L and 28R, 750 ft apart, departures from 1L and 1R (SFO; FAA); San Diego, one runway, 27 both ways,
         no departures 11:30 p.m. to 6:30 a.m. (SAN noise report; FAA remarks);
       - the paths down: 3.00 degrees at LAX (crossing the threshold at 55 ft), 3.00 and 2.85 at SFO 28R and 28L, 3.50
         at San Diego 27 to a threshold displaced 1,810 ft (crossing at 65 ft), with the step-down heights of the FAA
         charts of the 29 Oct 2026 cycle outside the final fix;
       - how many an hour: scheduled domestic flights by hour of a weekday (BTS on-time file, June 2026), scaled to the
         towers' own counts for LAX, SFO and San Diego (1,550, 1,141 and 657 movements a day);
       - the speed limit of 250 knots below 10,000 ft (14 CFR 91.117), 2.5 NM between aircraft on final and 5 NM behind
         a heavy (FAA Order JO 7110.65, 5-5-4), cruising levels by direction (14 CFR 91.179), Mach 0.78 to 0.85;
       - sizes and approach speeds of the types (FAA Aircraft Characteristics Database); San Diego's mix of types (its
         noise report, table 7).
     GENERATED (said again in info()): every individual flight, its type, colours and minute; the mix of types at LAX
       and SFO (none is published); the flows of the seven smaller airports (taken from the usual wind); how an
       aircraft slows down the approach, the take-off run, climb angles and the turns after take-off; the night runways
       at LAX (6L and 7R to land: the source gives only the direction); the routes and rates of the high traffic.
       Palm Springs and Fresno have runways here but no flights: the saved schedule file has no row for them. Foreign
       airlines, cargo and private aircraft are in the towers' counts only as the scale. */
  function SkyModel(D) {
    const FT = 0.3048, NM = 1852, KT = 0.514444, RD = Math.PI / 180, G0 = 9.81, M = { FT, NM, KT };
    const cl = (v, a, b) => (v < a ? a : v > b ? b : v), lp = (a, b, t) => a + (b - a) * t, ss = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const hash = (a, b, c, d) => { let h = 2166136261 ^ (a | 0); h = Math.imul(h ^ (b | 0), 16777619); h = Math.imul(h ^ (c | 0), 16777619); h = Math.imul(h ^ (d | 0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const mLat = la => 111132.92 - 559.82 * Math.cos(2 * RD * la) + 1.175 * Math.cos(4 * RD * la), mLon = la => 111412.84 * Math.cos(RD * la) - 93.5 * Math.cos(3 * RD * la);
    M.hash = hash; M.mLat = mLat; M.mLon = mLon;
    /* sizes in metres, approach speed in knots (FAA database); d: fuselage width, assumed from the type's cabin; eng: engines; wake: L large, H heavy, S super */
    const TYPES = M.TYPES = {
      A320: { name: 'Airbus A320', L: 37.6, span: 35.8, tail: 12.1, vapp: 136, wake: 'L', eng: 2, d: 3.95 },
      A321: { name: 'Airbus A321', L: 44.5, span: 35.8, tail: 12.1, vapp: 142, wake: 'L', eng: 2, d: 3.95 },
      B738: { name: 'Boeing 737-800 / MAX 8', L: 39.5, span: 35.8, tail: 12.6, vapp: 144, wake: 'L', eng: 2, d: 3.76 },
      B737: { name: 'Boeing 737-700', L: 33.6, span: 35.8, tail: 12.7, vapp: 130, wake: 'L', eng: 2, d: 3.76 },
      E75L: { name: 'Embraer 175', L: 32.3, span: 31.0, tail: 9.9, vapp: 126, wake: 'L', eng: 2, d: 3.0 },
      B789: { name: 'Boeing 787-9', L: 62.8, span: 60.1, tail: 17.1, vapp: 144, wake: 'H', eng: 2, d: 5.77 },
      B77W: { name: 'Boeing 777-300ER', L: 73.9, span: 64.8, tail: 18.8, vapp: 149, wake: 'H', eng: 2, d: 6.2 },
      A359: { name: 'Airbus A350-900', L: 66.6, span: 64.7, tail: 17.5, vapp: 140, wake: 'H', eng: 2, d: 5.96 },
      A388: { name: 'Airbus A380-800', L: 72.7, span: 79.8, tail: 24.1, vapp: 138, wake: 'S', eng: 4, d: 7.14 } };
    Object.keys(TYPES).forEach(k => { TYPES[k].key = k; });
    const MIX = M.MIX = {
      SAN: { B737: 135, E75L: 93, A321: 107, B738: 190, A320: 11, B789: 2, B77W: 2, A359: 2 },                   /* real: table 7 of the airport's noise report, April to June 2025 (757, 767, A220 and CRJ left out) */
      LAX: { B738: 24, A321: 18, A320: 12, B737: 8, E75L: 14, B789: 9, B77W: 8, A359: 5, A388: 2 },             /* assumed */
      SFO: { B738: 20, A320: 16, A321: 14, E75L: 17, B737: 6, B789: 10, B77W: 9, A359: 6, A388: 2 },            /* assumed */
      other: { B737: 45, B738: 30, E75L: 14, A320: 6, A321: 5 } };                                                /* assumed */
    /* generic colour schemes, no airline's: the colour goes on the fin, the winglets and the engines over a white or grey body */
    const LIVERY = M.LIVERY = [[0.07, 0.16, 0.42], [0.72, 0.08, 0.1], [0.05, 0.4, 0.45], [0.95, 0.52, 0.08], [0.2, 0.5, 0.82], [0.1, 0.33, 0.18], [0.36, 0.12, 0.42], [0.12, 0.12, 0.14], [0.9, 0.74, 0.1], [0.85, 0.86, 0.88], [0.55, 0.05, 0.25], [0.02, 0.25, 0.6]];
    /* runway use. scale: tower movements a day over the schedule file's (the rest is foreign, cargo and private). gs: glide path in degrees; tch: threshold crossing height, ft;
       fix: [NM from the threshold, ft above sea level] outside the final fix (FAA charts); out: bearings flown after take-off [true bearing, weight]; turn: height (ft above the field) before the turn */
    const FLOW = M.FLOW = {
      LAX: { scale: 1550 / 1123, arr: ['24R', '25L'], dep: ['24L', '25R'], gs: 3.0, tch: 55, out: [[315, 3, 4000], [255, 2, 3000], [140, 4, 3000]], night: { from: 0, to: 6.5, arr: ['6L', '7R'], dep: ['24L', '25R'] }, real: 'runways, flow, glide path, night over-ocean rule' },
      SFO: { scale: 1141 / 904, arr: ['28L', '28R'], pair: true, dep: ['1L', '1R'], depPair: true, cross: true, gs: 3.0, tch: 55, per: { '28L': { gs: 2.85, tch: 53, fix: [[5.4, 1700], [10, 3000], [14.1, 4000]] }, '28R': { fix: [[5.4, 1800], [10, 3000], [14.1, 4000]] } }, out: [[70, 4, 2000], [330, 3, 2000], [140, 3, 2500]], arrCap: 45, real: 'runways, paired arrivals 750 ft apart, glide paths, 45 arrivals an hour' },
      SAN: { scale: 657 / 610, arr: ['27'], dep: ['27'], gs: 3.5, tch: 65, fix: [[5.2, 2000], [7.4, 2700], [10.9, 3600], [12.9, 4000]], out: [[300, 4, 2000], [250, 2, 2000], [150, 4, 2500]], curfew: [23.5, 6.5], real: 'runway, 3.50 degree path, displaced threshold, departure curfew' },
      BUR: { arr: ['08'], dep: ['15'], cross: true }, LGB: { arr: ['30'], dep: ['30'] }, SNA: { arr: ['20R'], dep: ['20R'] }, ONT: { arr: ['26L'], dep: ['26R'] }, OAK: { arr: ['30'], dep: ['30'] }, SJC: { arr: ['30L'], dep: ['30R'] }, SMF: { arr: ['17R'], dep: ['17L'] } };
    Object.keys(FLOW).forEach(k => { const f = FLOW[k]; f.scale = f.scale || 1; f.gs = f.gs || 3.0; f.tch = f.tch || 50; f.out = f.out || [[0, 1, 1500], [90, 1, 1500], [180, 1, 1500], [270, 1, 1500]]; f.real = f.real || 'runways and flights an hour; the flow is assumed'; });
    M.MINSEP = 78; M.MINSEP_PAIR = 135; M.APPROACH_NM = 37;      /* seconds between landings on one runway at the least (3 NM at 140 kt); between pairs at SFO; where an arrival is first drawn */

    /* ---------- airports and runways ---------- */
    const AP = M.airports = {}; (D.airports || []).forEach(a => { AP[a.id] = a; a.elevM = a.elev * FT; a.kLat = mLat(a.lat); a.kLon = mLon(a.lat); a.ends = {};
      a.rw.forEach(r => { const [ida, idb, la1, lo1, la2, lo2, e1, e2, d1, d2, len, wid] = r, mk = (id, la, lo, el, dis, la_, lo_, el_) => { const e = (lo_ - lo) * a.kLon, n = (la_ - la) * a.kLat, l = Math.hypot(e, n) || 1; a.ends[id.replace(/^0/, '')] = a.ends[id] = { id, lat: la, lon: lo, elev: el * FT, displ: dis * FT, ue: e / l, un: n / l, len: l, lenFt: len, wid: wid * FT, hdg: (Math.atan2(e, n) / RD + 360) % 360, far: { lat: la_, lon: lo_, elev: el_ * FT } }; };
        mk(ida, la1, lo1, e1, d1, la2, lo2, e2); mk(idb, la2, lo2, e2, d2, la1, lo1, e1); }); });
    const endOf = (ap, id) => { const a = AP[ap]; return a ? a.ends[id] || null : null; };
    M.runway = endOf;
    /* a point d metres along a runway's direction from its end, s metres to its right */
    const along = (a, e, d, s) => { const ee = e.ue * d + e.un * (s || 0), nn = e.un * d - e.ue * (s || 0); return [e.lat + nn / a.kLat, e.lon + ee / a.kLon]; };
    M.along = along;

    /* ---------- the clock: seconds since 1970, and the Pacific hour of the day they fall in ---------- */
    let tzOff = -8; try { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false, timeZoneName: 'short' }).formatToParts(new Date()); if (p.some(x => x.type === 'timeZoneName' && /PDT/.test(x.value))) tzOff = -7; } catch (e) { /* Pacific standard time then */ }
    M.tzOff = tzOff; M.hourOf = t => (((t / 3600 + tzOff) % 24) + 24) % 24;
    const hourOfBlock = b => (((b + tzOff) % 24) + 24) % 24;

    /* ---------- the schedule: for each hour block, the landings and take-offs of one airport ---------- */
    const pickW = (tbl, u) => { let s = 0; for (const k in tbl) s += tbl[k]; let x = u * s; for (const k in tbl) { x -= tbl[k]; if (x < 0) return k; } return Object.keys(tbl)[0]; };
    const AID = {}; Object.keys(FLOW).forEach((k, i) => { AID[k] = i + 1; });
    const cache = new Map(), CMAX = 600;
    const nOf = (rate, seedA, seedB, seedC) => { const f = Math.floor(rate); return f + (hash(seedA, seedB, seedC, 77) < rate - f ? 1 : 0); };
    function rates(ap, b) { const H = D.hourly && D.hourly[ap], F = FLOW[ap]; if (!H || !F) return [0, 0]; const h = hourOfBlock(b); let a = H.arr[h] * F.scale, d = H.dep[h] * F.scale; if (F.arrCap) a = Math.min(a, F.arrCap); return [a, d]; }
    M.rates = (ap, hour) => { const H = D.hourly && D.hourly[ap], F = FLOW[ap]; if (!H || !F) return null; const h = ((Math.floor(hour) % 24) + 24) % 24; return { arr: Math.min(H.arr[h] * F.scale, F.arrCap || 1e9), dep: H.dep[h] * F.scale, scale: F.scale }; };
    const flowAt = (F, t) => { const n = F.night; if (!n) return F; const h = M.hourOf(t); return h >= n.from && h < n.to ? n : F; };
    /* the landings of one block: evenly spaced, each moved a little, never closer than the least spacing; a heavy goes early in its slot and the one behind it late */
    function arrivals(ap, b) {
      const key = 'a' + ap + b; let L = cache.get(key); if (L) return L; L = []; const F = FLOW[ap], id = AID[ap], [ra] = rates(ap, b), streams = F.pair ? 1 : F.arr.length, t0 = b * 3600;
      for (let s = 0; s < streams; s++) {
        const minSep = F.pair ? M.MINSEP_PAIR : M.MINSEP; let n = nOf(ra / (F.pair ? 2 : streams), id, b, 10 + s); n = Math.min(n, F.pair ? Math.floor(3600 / (minSep + 20)) : 31); if (!n) continue;   /* at most 31 an hour on one runway: then 5 NM behind a heavy holds */ const Hh = 3600 / n, jm = Math.min(0.3 * Hh, (Hh - minSep) / 2);
        const typeAt = (bb, k) => TYPES[pickW(MIX[ap] || MIX.other, hash(id, bb, k, 20 + s))], typeOf = k => typeAt(b, k), wakeOf = (bb, k) => { const a1 = typeAt(bb, k).wake, a2 = F.pair ? typeAt(bb, k + 500).wake : 'L'; return a1 === 'S' || a2 === 'S' ? 'S' : a1 === 'H' || a2 === 'H' ? 'H' : 'L'; };
        let prev = null, pS = [false, false]; { const [rp] = rates(ap, b - 1); let np = nOf(rp / (F.pair ? 2 : streams), id, b - 1, 10 + s); np = Math.min(np, F.pair ? Math.floor(3600 / (minSep + 20)) : 31); if (np > 0) { prev = wakeOf(b - 1, np - 1); pS = [typeAt(b - 1, np - 1).wake === 'S', F.pair && typeAt(b - 1, np - 1 + 500).wake === 'S']; } }   /* what the last one of the hour before was */
        for (let k = 0; k < n; k++) { const ty = typeOf(k), ty2 = F.pair ? typeOf(k + 500) : null, wk = ty.wake === 'S' || (ty2 && ty2.wake === 'S') ? 'S' : ty.wake === 'H' || (ty2 && ty2.wake === 'H') ? 'H' : 'L'; let j = (hash(id, b, k, 30 + s) * 2 - 1) * jm;
          if (wk !== 'L') j = -jm; else if (prev && prev !== 'L') j = jm; const skip = pS; pS = [ty.wake === 'S', !!ty2 && ty2.wake === 'S']; if (skip[0] && !F.pair) { prev = wk; continue; }   /* nothing lands on a runway in the slot behind an A380: 7 NM */
          const t = t0 + (k + 0.5) * Hh + j, fl = flowAt(F, t), mk = (rw, ty3, dt, tag) => ({ id: key + '_' + s + '_' + k + tag, ap, kind: 'arr', rw, type: ty3, t0: t + dt, liv: Math.floor(hash(id, b, k, 40 + s + (tag ? 5 : 0)) * LIVERY.length), sd: hash(id, b, k, 50 + s) });
          if (F.pair && fl === F) { if (!skip[0]) L.push(mk(F.arr[0], ty, -4, 'L')); if (!skip[1]) L.push(mk(F.arr[1], ty2, 0, 'R')); } else L.push(mk(fl.arr[(F.pair ? k : s) % fl.arr.length], ty, 0, ''));
          prev = wk; } }
      L.sort((x, y) => x.t0 - y.t0); if (cache.size > CMAX) cache.clear(); cache.set(key, L); return L;
    }
    /* the take-offs of one block: evenly spaced, then moved out of the way of the landings on the same or a crossing runway, and a minute apart at the least */
    function departures(ap, b) {
      const key = 'd' + ap + b; let L = cache.get(key); if (L) return L; L = []; const F = FLOW[ap], id = AID[ap], [, rd] = rates(ap, b), t0 = b * 3600, streams = F.depPair ? 1 : F.dep.length;
      const A = [].concat(arrivals(ap, b - 1), arrivals(ap, b), arrivals(ap, b + 1));
      for (let s = 0; s < streams; s++) {
        let n = nOf(rd / (F.depPair ? 2 : streams), id, b, 60 + s); if (!n) continue; let lo = t0, hi = t0 + 3600;
        if (F.curfew) { const h = hourOfBlock(b), c0 = F.curfew[0], c1 = F.curfew[1]; if (h === Math.floor(c1)) lo = t0 + (c1 % 1) * 3600; if (h === Math.floor(c0)) hi = t0 + (c0 % 1) * 3600; if ((c0 > c1 ? (h > c0 || h < Math.floor(c1)) : (h > c0 && h < Math.floor(c1)))) continue; }
        const Hh = (hi - lo) / n, raw = []; for (let k = 0; k < n; k++) raw.push(lo + (k + 0.5 + (hash(id, b, k, 70 + s) - 0.5) * 0.5) * Hh);
        let last = -1e18; raw.forEach((t, k) => {
          const fl = flowAt(F, t), rws = F.depPair ? fl.dep : [fl.dep[s % fl.dep.length]]; if (t < last + 62) t = last + 62;
          for (let it = 0; it < 6; it++) { let moved = false; for (const a of A) { const same = rws.includes(a.rw) || endOf(ap, a.rw) && rws.some(r => { const e = endOf(ap, r); return e && e.far.lat === endOf(ap, a.rw).lat && e.far.lon === endOf(ap, a.rw).lon; }), w = same ? [-78, 52] : F.cross ? [-50, 45] : null; if (w && t > a.t0 + w[0] && t < a.t0 + w[1]) { t = a.t0 + w[1]; moved = true; } } if (!moved) break; }
          if (t > hi - 20) return; last = t;
          rws.forEach((rw, i) => L.push({ id: key + '_' + s + '_' + k + '_' + i, ap, kind: 'dep', rw, type: TYPES[pickW(MIX[ap] || MIX.other, hash(id, b, k, 80 + s + i * 7))], t0: t + i * 0, liv: Math.floor(hash(id, b, k, 90 + s + i * 3) * LIVERY.length), sd: hash(id, b, k, 95 + s + i) })); });
      }
      L.sort((x, y) => x.t0 - y.t0); if (cache.size > CMAX) cache.clear(); cache.set(key, L); return L;
    }
    M.arrivals = arrivals; M.departures = departures;

    /* ---------- an arrival: down the extended centre line, on the glide path, to the runway and off it ---------- */
    const vProfile = (dn, vapp) => (dn <= 4 ? vapp : dn <= 8 ? lp(vapp, 180, (dn - 4) / 4) : dn <= 14 ? lp(180, 210, (dn - 8) / 6) : dn <= 22 ? lp(210, 250, (dn - 14) / 8) : 250);   /* knots at dn NM out: assumed, under the 250 knot rule */
    M.vProfile = vProfile;
    const DT = {}; function dTab(vapp) { let T = DT[vapp]; if (T) return T; const a = [0]; let d = 0; const far = (M.APPROACH_NM + 1) * NM; while (d < far && a.length < 3000) { d += vProfile(d / NM, vapp) * KT; a.push(d); } T = DT[vapp] = Float32Array.from(a); return T; }
    const cfg = (ap, rw) => { const F = FLOW[ap] || {}, p = F.per && F.per[rw] || {}; return { gs: p.gs || F.gs || 3, tch: p.tch || F.tch || 50, fix: p.fix || (F.arr && F.arr.includes(rw) ? F.fix : null) || null }; };
    /* height above sea level, ft, d metres before the landing threshold */
    function pathFt(ap, rw, d) { const e = endOf(ap, rw), c = cfg(ap, rw), tdze = e.elev / FT, dn = d / NM, own = tdze + c.tch + Math.tan(c.gs * RD) * d / FT; let h = own;
      if (c.fix && dn > c.fix[0][0]) { const f = c.fix, n = f.length; h = null; for (let i = 0; i < n - 1; i++) if (dn <= f[i + 1][0]) { h = lp(f[i][1], f[i + 1][1], (dn - f[i][0]) / (f[i + 1][0] - f[i][0])); break; } if (h == null) h = f[n - 1][1] + (dn - f[n - 1][0]) * Math.tan(3 * RD) * NM / FT; }
      return Math.min(h, Math.max(10000, tdze + 9000)); }
    M.pathFt = pathFt; M.config = cfg;
    function arrPose(f, t) {
      const a = AP[f.ap], e = endOf(f.ap, f.rw); if (!e) return null; const c = cfg(f.ap, f.rw), ty = f.type, va = ty.vapp * KT, tau = f.t0 - t, T = dTab(ty.vapp), tg = Math.tan(c.gs * RD), tchM = c.tch * FT;
      const o = { f, kind: 'arr', hdg: e.hdg, bank: 0, gear: false, ground: false, ll: true, trail: 0, base: e.elev };
      if (tau >= 0) { if (tau >= T.length - 1) return null; const i = Math.floor(tau), d = lp(T[i], T[i + 1], tau - i); if (d > M.APPROACH_NM * NM) return null; const p = along(a, e, e.displ - d, 0); o.lat = p[0]; o.lon = p[1]; o.alt = pathFt(f.ap, f.rw, d) * FT; o.v = vProfile(d / NM, ty.vapp) * KT; o.pitch = lp(2.5, -0.5, ss(8, 18, d / NM)); o.gear = d < 5 * NM; o.dist = d; o.phase = 'final'; return o; }
      const xtd = (tchM - 5 + 5 * Math.log(5 / 0.3)) / tg, ttd = xtd / va, u = -tau;
      if (u < ttd) { const x = u * va, g = tchM - x * tg, h = g >= 5 ? g : 5 * Math.exp((g - 5) / 5), p = along(a, e, e.displ + x, 0); o.lat = p[0]; o.lon = p[1]; o.alt = e.elev + h; o.v = va; o.pitch = lp(2.5, 5, ss(8, 1, h)); o.gear = true; o.dist = -x; o.phase = 'flare'; return o; }
      const vt = 10, room = Math.max(500, 0.72 * (e.len - e.displ) - xtd), dec = Math.max(1.7, (va * va - vt * vt) / (2 * room)), t1 = (va - vt) / dec, w = u - ttd; o.ground = true; o.gear = true; o.alt = e.elev; o.pitch = lp(5, 0, ss(0, 4, w));
      if (w < t1) { const x = xtd + va * w - 0.5 * dec * w * w, p = along(a, e, e.displ + x, 0); o.lat = p[0]; o.lon = p[1]; o.v = va - dec * w; o.dist = -x; o.phase = 'roll'; return o; }
      const q = w - t1; if (q > 15) return null; const x1 = xtd + va * t1 - 0.5 * dec * t1 * t1, side = f.sd < 0.5 ? 1 : -1, s40 = Math.sin(40 * RD), c40 = Math.cos(40 * RD), lat = vt * s40 * (q < 6 ? q * q / 12 : q - 3), al = vt * (q < 6 ? q - (1 - c40) * q * q / 12 : 6 - (1 - c40) * 3 + (q - 6) * c40), p = along(a, e, e.displ + x1 + al, side * lat);
      o.lat = p[0]; o.lon = p[1]; o.v = vt; o.hdg = (e.hdg + side * 40 * ss(0, 6, q) + 360) % 360; o.dist = -(x1 + al); o.phase = 'exit'; o.ll = false; return o;
    }
    /* ---------- a departure: the run, the climb and one turn, worked a second at a time and kept ---------- */
    const tracks = new Map();
    function depTrack(f) {
      let K = tracks.get(f.id); if (K) return K; const e = endOf(f.ap, f.rw), F = FLOW[f.ap], ty = f.type, vr = ty.vapp * 1.1 * KT, N = 620, X = new Float32Array(N), Y = new Float32Array(N), Hh = new Float32Array(N), Hd = new Float32Array(N), Pi = new Float32Array(N), Bk = new Float32Array(N), V = new Float32Array(N);
      const out = F.out, ow = out.reduce((s, o) => s + o[1], 0); let pick = f.sd * ow, tgt = out[0]; for (const o of out) { pick -= o[1]; if (pick < 0) { tgt = o; break; } }
      let x = 0, y = 60, h = 0, v = 0, hd = e.hdg, pit = 0, bank = 0, air = false, n = 0;   /* x east, y north of the runway's end, metres; h above it */
      const ue = e.ue, un = e.un; x = ue * 60; y = un * 60;
      for (let i = 0; i < N; i++) { X[i] = x; Y[i] = y; Hh[i] = h; Hd[i] = hd; Pi[i] = pit; Bk[i] = bank; V[i] = v; n = i + 1;
        if (!air) { v += 2.3; pit = v > vr - 5 ? Math.min(12, pit + 4) : 0; if (v >= vr + 4) air = true; }
        else { const hf = h / FT, vmax = (hf > 10000 ? 300 : 250) * KT, ga = hf < 1500 ? 8 : hf < 10000 ? 5.5 : 3.5; v = Math.min(vmax, v + 0.5); h += v * Math.sin(ga * RD); pit = lp(pit, ga + 4, 0.3);
          let want = 0; if (hf >= tgt[2] && Math.hypot(x, y) > e.len + 1500) { const dh = ((tgt[0] - hd + 540) % 360) - 180; if (Math.abs(dh) > 0.5) { const rate = Math.min(3, G0 * Math.tan(25 * RD) / v / RD); hd = (hd + cl(dh, -rate, rate) + 360) % 360; want = Math.sign(dh) * Math.min(25, Math.abs(dh) * 2.5); } }
          bank = lp(bank, want, 0.35); }
        x += v * Math.sin(hd * RD); y += v * Math.cos(hd * RD); if (Math.hypot(x, y) > 80000 || h > 5600) break; }
      K = { n, X, Y, Hh, Hd, Pi, Bk, V }; if (tracks.size > 400) tracks.clear(); tracks.set(f.id, K); return K;
    }
    function depPose(f, t) {
      const a = AP[f.ap], e = endOf(f.ap, f.rw); if (!e) return null; const u = t - f.t0; if (u < -40) return null; const K = depTrack(f); if (u >= K.n - 1) return null;
      const uu = Math.max(0, u), i = Math.floor(uu), w = uu - i, L = (A) => lp(A[i], A[i + 1], w), dh = ((K.Hd[i + 1] - K.Hd[i] + 540) % 360) - 180, x = L(K.X), y = L(K.Y), h = L(K.Hh);
      return { f, kind: 'dep', lat: e.lat + y / a.kLat, lon: e.lon + x / a.kLon, alt: e.elev + h, hdg: (K.Hd[i] + dh * w + 360) % 360, pitch: L(K.Pi), bank: L(K.Bk), v: L(K.V), gear: h < 60, ground: h <= 0, ll: h < (10000 * FT - e.elev), trail: 0, base: e.elev, dist: Math.hypot(x, y), phase: u < 0 ? 'lined up' : h <= 0 ? 'take-off run' : 'climb' };
    }
    M.depTrack = depTrack;

    /* ---------- the high traffic: straight lines between real places at cruising level (all generated) ---------- */
    /* [name, lat, lon, lat, lon, flights an hour each way by day (assumed)] */
    const ROUTES = M.ROUTES = [['Pacific Northwest and Los Angeles', 42.2, -122.8, 33.6, -117.9, 5], ['Bay Area and Los Angeles', 37.9, -122.5, 33.7, -118.1, 5], ['Bay Area and the east', 37.5, -123.4, 39.6, -114.2, 5], ['Los Angeles and Las Vegas, the east', 33.8, -119.6, 36.1, -114.4, 6],
      ['Los Angeles and Phoenix, the south', 33.9, -119.4, 33.3, -114.3, 5], ['The Pacific and the east over the Bay', 37.0, -125.6, 38.6, -114.0, 3], ['San Diego and the north', 32.6, -117.0, 38.9, -122.6, 3], ['The Pacific and the east over Los Angeles', 33.2, -122.6, 34.9, -114.2, 3], ['Sacramento Valley and the south', 41.5, -122.3, 34.6, -117.6, 3]];
    const DAYSHAPE = [0.35, 0.25, 0.15, 0.1, 0.1, 0.3, 0.6, 0.9, 1.1, 1.1, 1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1, 1, 1, 1, 1, 0.8, 0.6];   /* assumed: the shape of the three airports' day, smoothed */
    const RT = ROUTES.map((r, i) => { const la = (r[1] + r[3]) / 2, kx = mLon(la), ky = mLat(la), e = (r[4] - r[2]) * kx, n = (r[3] - r[1]) * ky, len = Math.hypot(e, n); return { i, name: r[0], a: [r[1], r[2]], b: [r[3], r[4]], kx, ky, e, n, len, hdg: (Math.atan2(e, n) / RD + 360) % 360, rate: r[5] }; });
    function cruise(t, out) {
      const b = Math.floor(t / 3600);
      for (const r of RT) for (let dir = 0; dir < 2; dir++) { const hdg = dir ? (r.hdg + 180) % 360 : r.hdg;
        for (let bb = b - 2; bb <= b; bb++) { const n = nOf(r.rate * DAYSHAPE[hourOfBlock(bb)], 900 + r.i, bb, dir); for (let k = 0; k < n; k++) {
          const u1 = hash(900 + r.i, bb, k, 100 + dir), u2 = hash(900 + r.i, bb, k, 110 + dir), u3 = hash(900 + r.i, bb, k, 120 + dir), u4 = hash(900 + r.i, bb, k, 130 + dir), t0 = bb * 3600 + (k + u1) * 3600 / n, v = (0.78 + 0.07 * u2) * 295, s = (t - t0) * v; if (s < 0 || s > r.len) continue;
          const fr = dir ? 1 - s / r.len : s / r.len, off = (u3 - 0.5) * 16000, fl = hdg < 180 ? [310, 330, 350, 370, 390][Math.floor(u4 * 5)] : [320, 340, 360, 380, 400][Math.floor(u4 * 5)];
          const pe = -r.n / r.len * off, pn = r.e / r.len * off, lat = r.a[0] + (r.n * fr + pn) / r.ky, lon = r.a[1] + (r.e * fr + pe) / r.kx, wet = hash(900 + r.i, Math.floor(bb / 6), 3, 140);   /* the air's humidity along a route, six hours at a time: generated */
          const ty = TYPES[pickW({ B738: 30, A321: 20, A320: 15, B737: 10, B789: 9, B77W: 7, A359: 6, A388: 1, E75L: 2 }, u2)];
          out.push({ f: { id: 'c' + r.i + '_' + dir + '_' + bb + '_' + k, kind: 'crz', type: ty, liv: Math.floor(u3 * LIVERY.length), route: r.name, fl }, kind: 'crz', lat, lon, alt: fl * 100 * FT, hdg, pitch: 2, bank: 0, v, gear: false, ground: false, ll: false, base: 0, phase: 'cruise FL' + fl, trail: wet < 0.25 ? 0 : wet < 0.65 ? 3000 + 9000 * u1 : 22000 + 40000 * u1 }); } } }
      return out;
    }
    M.cruise = cruise;

    /* ---------- everything in the air at t (seconds since 1970) within `reach` metres of a place ---------- */
    M.flightsAt = (t, lat, lon, reach, o) => {
      o = o || {}; const out = [], b = Math.floor(t / 3600), R = reach || 1e9, ky = mLat(lat), kx = mLon(lat);
      for (const ap in FLOW) { const a = AP[ap]; if (!a) continue; if (Math.hypot((a.lat - lat) * ky, (a.lon - lon) * kx) > R + 85000) continue;
        for (let bb = b - 1; bb <= b + 1; bb++) { for (const f of arrivals(ap, bb)) { if (f.t0 < t - 200 || f.t0 > t + 1300) continue; const p = arrPose(f, t); if (p) out.push(p); }
          for (const f of departures(ap, bb)) { if (f.t0 > t + 40 || f.t0 < t - 640) continue; const p = depPose(f, t); if (p) out.push(p); } } }
      if (o.cruise !== false) cruise(t, out);
      return R < 1e8 ? out.filter(p => Math.hypot((p.lat - lat) * ky, (p.lon - lon) * kx) < R) : out;
    };
    M.arrPose = arrPose; M.depPose = depPose;
    M.nearest = (lat, lon) => { let best = null; for (const k in AP) { const a = AP[k], d = Math.hypot((a.lat - lat) * mLat(lat), (a.lon - lon) * mLon(lat)); if (!best || d < best.d) best = { a, d }; } return best; };
    /* in words: the nearest airport, its runways in use at this hour, and what is in the air round it */
    M.info = (t, lat, lon) => {
      const nb = M.nearest(lat, lon); if (!nb) return null; const a = nb.a, F = FLOW[a.id], h = M.hourOf(t), fl = F ? flowAt(F, t) : null, r = F ? M.rates(a.id, h) : null, near = F ? M.flightsAt(t, a.lat, a.lon, 90000, { cruise: false }).filter(p => p.f.ap === a.id) : [];
      return { airport: a.id, name: a.name, km: +(nb.d / 1000).toFixed(1), hour: +h.toFixed(2), landing: fl ? fl.arr.slice() : [], departing: fl ? fl.dep.slice() : [], arrivalsPerHour: r ? +r.arr.toFixed(1) : 0, departuresPerHour: r ? +r.dep.toFixed(1) : 0,
        arriving: near.filter(p => p.kind === 'arr').length, departingNow: near.filter(p => p.kind === 'dep').length, real: F ? F.real : 'runways only: no flights are drawn here (a military field, or no row in the schedule file)',
        generated: 'every individual flight (type, colours, minute)', flights: near.map(p => ({ kind: p.kind, rw: p.f.rw, type: p.f.type.key, phase: p.phase, altFt: Math.round(p.alt / FT), kt: Math.round(p.v / KT), nm: p.dist != null ? +(p.dist / NM).toFixed(1) : null })) };
    };
    return M;
  }
  SE.SkyModel = SkyModel;
