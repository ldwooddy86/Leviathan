  /* The record a ZIP's outlook draws on: its gust days, its rain and atmospheric river days, its hail days, and the pace of
     its fire losses (CAL FIRE's inspections, 2013 to 2025: structures destroyed, and damaged at half weight, a year,
     over the ZIP's homes), steadied by the ZIPs within OC.nearKm. Everything is a yearly rate for a shingle roof of
     average age before the covering, its age, the building's height and its fire zone turn it. */
  const N_FIRE = OC.fireTo - OC.fireFrom + 1, HAZ = new Map();
  const fireLoss = z => (wxCol(z, 'dest') || 0) + OC.dmgW * (wxCol(z, 'dmg') || 0);
  function hazardAt(zip) {
    let h = HAZ.get(zip); if (h) return h;
    const z = ZI[zip] || null, v = k => (z ? wxCol(z, k) : null), n0 = x => (x == null ? 0 : x);
    const g58 = Math.min(n0(v('g58')), OC.capG58), g75 = Math.min(n0(v('g75')), OC.capG75);
    /* fire: own and neighbours */
    let own = 0, nb = 0, near = 0, nbHu = 0, nbLoss = 0;
    if (z) { const hu = Math.max(+z.hu || +z.roofs || 0, 50); own = fireLoss(z) / (N_FIRE * hu);
      if (isN(z.lat)) Z.forEach(q => { if (q.zip === zip || !isN(q.lat) || !(q.hu > 0)) return; if (Math.abs(q.lat - z.lat) > 0.5 || Math.abs(q.lon - z.lon) > 0.6) return; if (meters([z.lat, z.lon], [q.lat, q.lon]) > OC.nearKm * 1000) return; near++; nbHu += +q.hu; nbLoss += fireLoss(q); });
      nb = nbHu > 0 ? nbLoss / (N_FIRE * nbHu) : own; }
    const fireRate = clamp(near ? OC.own * own + (1 - OC.own) * nb : own, 0, 0.2), dest = z ? n0(v('dest')) : 0, dm = z ? n0(v('dmg')) : 0, fireRep = dest + dm > 0 ? dest / (dest + OC.dmgW * dm) : 0.9;
    /* rain against the state: days with an inch of rain plus atmospheric river days of rank 3 and up */
    const wet = z0 => { const a = wxCol(z0, 'rd1'), r3 = (wxCol(z0, 'ar3') || 0) + (wxCol(z0, 'ar4') || 0) + (wxCol(z0, 'ar5') || 0); return a == null && !r3 ? null : (a || 0) + r3; };
    if (!HAZ.has('*wet')) { let s = 0, n = 0; Z.forEach(q => { const w = wet(q), r = +q.roofs || 0; if (w != null && r > 0) { s += w * r; n += r; } }); HAZ.set('*wet', n > 0 ? s / n : null); }
    const wz = z ? wet(z) : null, wm = HAZ.get('*wet'), snow = n0(v('snow'));
    const rainK = (wz != null && wm > 0 ? clamp(Math.sqrt(wz / wm), OC.rainLo, OC.rainHi) : 1) * (1 + OC.snowLeak * clamp(snow / 100, 0, 1));
    h = { zip, z, days: { g40: v('g40'), g58: v('g58'), g75: v('g75') }, wind: [g58 * OC.wind[0][0], g75 * OC.wind[1][0]], capped: n0(v('g58')) > OC.capG58 || n0(v('g75')) > OC.capG75,
      rainK, wet: wz, wetState: wm, fire: { rate: fireRate, own, nb, near, rep: fireRep, dest, dmg: dm }, hailDays: [n0(v('hd1')), n0(v('hd175'))], hasHail: v('hd1') != null,
      ar: ['ar1', 'ar2', 'ar3', 'ar4', 'ar5'].map(k => v(k)), snow: v('snow'), lat: z ? z.lat : null, lon: z ? z.lon : null };
    HAZ.set(zip, h); return h;
  }
  /* the fire zone's turn on the ZIP's pace, for one building: the ZIP's losses fall mostly in its High and Very High
     zones, so a building inside them takes the pace over the zones' share of the ZIP (at most four times it), one in a
     Moderate zone the ZIP's own pace, and one outside every zone half of it where the ZIP has such zones at all: embers
     carried the 2017 and 2025 fires well past the mapped zones (Coffey Park, the Altadena flats). A judgment, grade D.
     Without the building's zone (the layer did not answer), the ZIP's pace as it is. */
  function fireK(b) { if (!b || !b.fhsz) return 1; const hv = fhszHV(b.z) || 0, c = b.fhsz.cls; return c >= 2 ? clamp(100 / Math.max(hv, 25), 1, 4) : c === 1 ? 1 : hv >= 5 ? 0.5 : 1; }
  const fkKey = v => (isN(v) ? clamp(+v, 0, 4) : 1).toFixed(2);
  /* the heat a roof of a kind takes at a place against the average California roof of that kind (by one unit roofs):
     the Thermal reading's yearly ageing rate, from the 1991 to 2020 normals. The outlook shortens or stretches the
     roof's life by the square root of it: heat is one of several things that age a roof (judgment). */
  const SHEAT = new Map();
  function stateHeat(type) { let v = SHEAT.get(type); if (v !== undefined) return v; let s = 0, n = 0; Z.forEach(z => { const w = +z.roofs || 0; if (!(w > 0) || !isN(z.lat)) return; s += w * heatRef(type, z.lat, z.lon); n += w; }); v = n > 0 ? s / n : null; SHEAT.set(type, v); return v; }
  function climHeat(type, la, lo) { if (!isN(la) || !isN(lo)) return 1; const s = stateHeat(type); return s > 0 ? clamp(heatRef(type, la, lo) / s, 0.6, 1.6) : 1; }
