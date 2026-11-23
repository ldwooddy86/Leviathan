  /* moss and algae on a roof of age a (a chance they show). They follow water: the north coast's 40 to 70 inches of rain
     a year grow moss on any shaded slope, the deserts' 3 to 6 almost none. How soon they show was not found in any
     source; the curve (half of unprotected shingle roofs marked by about fifteen years in average light where 20
     inches fall) is a judgment, grade D. slopeK: 1.6 shaded or north, 0.6 full sun; the ZIP's normal rain over 20
     inches (held between 0.3 and 2.5) works the same way. */
  const algaeAt = (a, typeK, slopeK) => clamp(typeK, 0, 1.3) * (1 - Math.exp(-Math.pow(Math.max(0, a) / (15 / Math.sqrt(slopeK || 1)), 2.5)));
  const wetK = z => { const r = wxCol(z, 'rainIn'); return r == null ? 1 : clamp(r / 20, 0.3, 2.5); };
  /* rust that needs a roofer on a steel roof of age a, with salt air (a Weibull on the coating and fastener life: 32 years
     inland; judgment, grade D). km is the distance to the Pacific or a bay shore as coastKm measures it. */
  const rustOn = (a, k) => 1 - Math.exp(-Math.pow(Math.max(0, a) / (32 * k), 3));
  const rustAt = (a, typeK, km) => clamp(typeK, 0, 1) * rustOn(a, saltK(km));
  /* both by age, once, for the count: growth on an unprotected roof in average light where 20 inches of rain fall, rust at each step of salt air */
  const ALG1 = Float64Array.from({ length: QN }, (_, a) => algaeAt(a, 1, 1)), RUST1 = SALT.map(k => Float64Array.from({ length: QN }, (_, a) => rustOn(a, k)));
  /* the kinds of roof a building may carry, with their odds: the clock's coverings */
  function typesOf(b) { const rf = b.roof || {}, keys = rf.keys || []; return keys.filter(x => RTYPE[x[0]]).map(([k, w]) => [k, w]); }
  /* a building's outlook: its own mix (b.mix: covering, year the clock started, weight) blended, for each covering, into
     one spread of roof ages today and counted once; the coverings blended; each kind of roof it may carry, apart; and the
     slower marks on the roof then in place. o.heat: how hard the sun works this roof against the average roof of its
     kind at this place; without it, the heat the Scout Engine last read for this roof (b.heatK), so the card and the
     roof views say the same thing. The place's own heat against the state's (climHeat) is always in. A ZIP with no row
     in the atlas has no weather on record here, so no outlook. The result is kept on the building until its mix is read again. */
  function outlookOf(b, o) {
    o = o || {}; const zip = b.zip || b.zipF || '', mix = b.mix || [], types = typesOf(b); if (!mix.length || !types.length || !zip || !ZI[zip]) return null;
    const st = b.cls === 'sf' || b.cls === 'mf' || b.cls === 'mh' || b.cls === 'garage' || b.cls === 'shed' ? storiesRes(b.h) : Math.min(3, floorsCom(b.h)), own = o.heat != null ? o.heat : b.heatK, fk = fireK(b);
    const mk = [fkKey(fk), st, isN(own) ? clamp(own, 0.5, 1.6).toFixed(2) : '1', b.fhsz ? b.fhsz.cls : 'x'].join('|'); if (b._o && b._o.mix === mix && b._o.key === mk) return b._o.O;
    const km = coastKm(b.lat, b.lon), si = saltIx(km), starts = {}, LEN = HMAX + 2;
    /* each covering's spread of roof ages today, over the years its clock may have started in */
    const start = (k, y, w) => { if (!(w > 0) || !RTYPE[k]) return; const d = (rstate(RTYPE[k].life, zip, y) || {}).dist; let s2 = starts[k]; if (!s2) s2 = starts[k] = { d: new Float64Array(LEN), w: 0 }; if (d) { for (let a = 0, n = Math.min(d.length, LEN); a < n; a++) s2.d[a] += d[a] * w; } else s2.d[0] += w; s2.w += w; };
    mix.forEach(([k, y, w]) => start(k, y, w));
    const parts = [], per = {}, heatBy = {}, tail = new Float64Array(LEN + 1); let PW = 0;
    Object.keys(starts).forEach(k => { const s2 = starts[k]; if (!(s2.w > 0)) return; for (let a = 0; a < LEN; a++) s2.d[a] /= s2.w; const ck = climHeat(k, b.lat, b.lon); heatBy[k] = ck; const f = count(k, zip, s2.d, { fk, st, heat: clamp((isN(own) ? own : 1) * ck, 0.5, 1.6) }); parts.push([f, s2.w]); per[k] = f; PW += s2.w; let run = 0; for (let a = LEN - 1; a >= 0; a--) { tail[a] += s2.w * run; run += s2.d[a]; } });
    if (!(PW > 0)) return null; for (let a = 0; a <= LEN; a++) tail[a] /= PW;   /* tail[n]: the chance today's roof is more than n years old */
    const all = blend(parts, si), hz = hazardAt(zip), wk = wetK(b.z);
    const byType = types.map(([k, w]) => ({ k, w, l: RTYPE[k].l, o: per[k] ? blend([[per[k], 1]], si) : null })).filter(x => x.o && x.o.W > 0);
    /* the slower marks by year, on the roof then in place: over the kinds of roof the building may carry (slow), and for a
       kind taken alone, RTYPE[k].algae times the place's wetness times that kind's o.alg, or .rust times its o.rust */
    const slow = { algae: new Float64Array(OUT_Y + 1), rust: new Float64Array(OUT_Y + 1) }; let TW = 0; byType.forEach(r => { TW += r.w; });
    if (TW > 0) for (let t = 0; t <= OUT_Y; t++) { let al = 0, ru = 0; byType.forEach(r => { const T = RTYPE[r.k]; al += r.w * clamp(T.algae * wk * r.o.alg[t], 0, 1); ru += r.w * T.rust * r.o.rust[t]; }); slow.algae[t] = al / TW; slow.rust[t] = ru / TW; }
    const older = n => tail[clamp(Math.floor(+n || 0), 0, LEN)];
    const clim = types.reduce((s, [k, w]) => s + (heatBy[k] || 1) * w, 0) / (types.reduce((s, x) => s + x[1], 0) || 1);
    const O = { zip, all, byType, slow, hz, km, st, fk, wetK: wk, types, heat: isN(own) ? own : null, clim, older };
    b._o = { mix, key: mk, O }; return O;
  }
  /* the causes in order at a year */
  const causeRank = (O, t) => CAUSES.map(([c, l]) => ({ c, sub: c, l, p: O.C[c][t], rep: O.R[c][t], fix: O.F[c][t] })).sort((x, y) => y.p - x.p);
  const causeText = k => (k.c === 'wear' ? 'heat, sun and age' : k.l.toLowerCase());
  const causeShort = causeText;
