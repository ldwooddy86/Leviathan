  const QN = HMAX + OUT_Y + 6, QT = new Map();
  /* what a year does to a roof of each age, for one kind of roof at one ZIP at one height, heat and fire zone factor (fk,
     given as its key): for every cause the chance it replaces the roof (r) and the chance it is repaired after it (f);
     the chance nothing replaces it (stay), and that nothing touches it (none). The chances depend on the roof's age
     and not on the year, so the table is made once and every count reads it. */
  function chances(type, zip, rec, st, heat) {
    const key = [type, zip, rec, st, heat.toFixed(2)].join('|'); let q = QT.get(key); if (q) return q;
    const T = RTYPE[type] || RTYPE.shingle, hz = hazardAt(zip), p = LIFE[T.life] || LIFE.shingle, lam = p.lam / Math.pow(heat, 0.5), kk = p.k, S = a => Math.exp(-Math.pow(a / lam, kk)), wk = T.wind * OC.tall(st), CK = CAUSES.map(([c]) => c), fk = +rec || 1;
    const wR = hz.wind[0] * OC.wind[0][1] + hz.wind[1] * OC.wind[1][1], wF = hz.wind[0] * (1 - OC.wind[0][1]) + hz.wind[1] * (1 - OC.wind[1][1]);
    const h1 = hz.hailDays[0] * OC.hail[0][0] * T.hail[0], h2 = hz.hailDays[1] * OC.hail[1][0] * T.hail[1], haR = h1 * OC.hail[0][1] + h2 * OC.hail[1][1], haF = h1 * (1 - OC.hail[0][1]) + h2 * (1 - OC.hail[1][1]);
    const fr = clamp(hz.fire.rate * fk * T.fire, 0, 0.3), fR = fr * hz.fire.rep, fF = fr * (1 - hz.fire.rep);
    q = { CK, r: CK.map(() => new Float64Array(QN)), f: CK.map(() => new Float64Array(QN)), stay: new Float64Array(QN), none: new Float64Array(QN), hz };
    for (let a = 0; a < QN; a++) { const wa = windAgeK(a, T.ageK) * wk, ha = hailAgeK(a, T.hailK), sa = S(a);
      const x = { wear: [sa > 0 ? 1 - S(a + 1) / sa : 1, 0], wind: [clamp(wR * wa, 0, 0.5), clamp(wF * wa, 0, 0.5)], rain: [0, clamp(repRate(a) * T.leak * hz.rainK, 0, 0.5)], fire: [fR, fF], hail: [clamp(haR * ha, 0, 0.5), clamp(haF * ha, 0, 0.5)] };
      let stay = 1, none = 1; CK.forEach((c, i) => { let r = clamp(x[c][0], 0, 1), f = x[c][1]; if (r + f > 1) f = 1 - r; q.r[i][a] = r; q.f[i][a] = f; stay *= 1 - r; none *= 1 - r - f; }); q.stay[a] = stay; q.none[a] = none; }
    if (QT.size > 600) QT.clear(); QT.set(key, q); return q;
  }
