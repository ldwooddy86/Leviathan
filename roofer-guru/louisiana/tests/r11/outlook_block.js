  /* ---------- the next fifteen years: what each kind of roof is likely to suffer where it stands ---------- */
  /* A forecast built from the atlas's own records, year by year for fifteen years, for one kind of roof at one ZIP whose
     age today is known as a spread of chances (the clock above). Each year a roof in place can:
       wear out          its Weibull life (module 17: asphalt shingles 22 years, calibrated to the American Housing Survey);
       take a hurricane  the ZIP's storm years as the roof clock above counts them: the share of its roofs each one
                         replaced (from 2004 module 17's count: FEMA's verified roof and wind damage where FEMA has it,
                         the storm's modelled wind through the atlas's damage curve elsewhere; before 2004 that curve,
                         scaled by how FEMA's counts have compared with it), and beside the roofs replaced those damaged
                         and repaired (OC.anyM: about three more for each one in a mild year, about one in a hard
                         one). Two records are kept: the years
                         the file resolves storm by storm (1990 on) and the 76 years since 1950, over which hurricane
                         years came less often; the outlook uses their mean and shows both;
       take a thunderstorm or tornado   the days a year with 58 mph wind, 75 mph wind and EF1 tornadoes within 25 miles (SPC
                         1996 to 2025), at the atlas's stated rates of roofs damaged per day (module 12);
       take hail         the days a year with 1 inch and 1.75 inch hail within 25 miles, at the atlas's stated rates, turned
                         for each covering by the hail size that damages it (Haag Engineering's thresholds);
       leak              the repair line's calls a year, shaped by the roof's age (the shape is a judgment);
     and two slower things are told beside them: algae on shingles, and rust on metal near salt water. A roof that is
     replaced starts again at age zero and stays in the count. What comes out is a chance, for the building's kind of roof
     at its ZIP, of each kind of damage by each year: a forecast of the odds, not of a storm. Every rate that is a
     judgment is marked in OC. */
  const OUT_Y = 15;
  const OC = {
    /* Roofs damaged at all against roofs replaced in a storm year, as a ratio of hazards: a roof of a given age that the
       year replaces with hazard x is damaged at all with hazard anyM times x. Over Louisiana's roof ages that comes to
       about four roofs damaged for each one replaced in a year that replaces 1 percent, 3.3 at 10 percent, 2.3 at 27
       percent and 1.7 at 45. Set from the one survey that counted damage in Louisiana where the roof clock has a count:
       after Gustav in Houma IBHS found roof cover damage on 602 of 933 houses (65 percent), on more than 5 percent of the
       roof on 27 percent of them and more than 15 percent on 13 (Liu and others 2010); the clock, from FEMA's
       registrations, has 23 to 49 percent of the roofs standing in Houma's three ZIPs replaced that year. What is not
       replaced is repaired, never fewer than a fifth of the replacements nor more than the roofs left. Grade D. */
    anyM: 4.2,
    /* thunderstorm wind and tornado days: roofs damaged per day within 25 miles (module 12's stated rates), and the share
       of that damage that is a replacement, not a repair (judgment) */
    ts: [[+((META.model && META.model.ANCH && META.model.ANCH.wind) || [])[0] || 0.0003, 0.2], [+((META.model && META.model.ANCH && META.model.ANCH.wind) || [])[1] || 0.0015, 0.4], [+((META.model && META.model.ANCH && META.model.ANCH.wind) || [])[2] || 0.0025, 0.8]],
    /* hail: roofs damaged per day with 1 inch hail, and a further share per day with 1.75 inch hail (module 12's stated
       rates), with the share replaced (insurers replace slopes with functional hail damage; judgment) */
    hail: [[+((META.model && META.model.ANCH && META.model.ANCH.hail) || [])[0] || 0.0022, 0.6], [+((META.model && META.model.ANCH && META.model.ANCH.hail) || [])[1] || 0.004, 0.9]],
    /* A roof's age against the wind, as a multiple of the hazard (before scaling: the average Louisiana roof is 1).
       Shingles hold for their first years and then let go: the University of Florida found no unsealed shingles on
       roofs under four years old, under 1 percent of strips at six years, 12 percent at 7 to 13 and 30 percent at 14
       to 20, with hip and ridge caps unsealed at every age (Dixon and others 2013); in Laura, near Lake Charles, 40 percent of two to three year old shingle roofs were
       damaged and 7 percent lost a quarter of their cover, against 97 percent of those 14 to 15 years old, with a break
       near eight years (NIST 2026, 623 homes); in the 2020 derecho a roof over ten years old was five times as likely
       to show damage as one of three to six (IBHS 2023). The multiple below is drawn through those (judgment, grade D)
       and scaled so that Louisiana's roofs at their ages today (module 17) average what each storm year cost. The
       same multiple works on thunderstorm wind. */
    age: a => (a <= 3 ? 0.08 : a <= 6 ? 0.08 + (a - 3) * 0.26 / 3 : a <= 9 ? 0.34 + (a - 6) * 0.22 : a <= 15 ? 1 + (a - 9) * 0.4 / 6 : a <= 20 ? 1.4 + (a - 15) * 0.04 : 1.6),
    /* Metal, tile and slate age another way. In Ian damage was rare on any roof in its first five years, and on metal
       and tile it rose negligibly until the roof was past ten; past five years 10 to 15 percent of them showed damage on
       5 percent or more of the roof against almost half of shingle roofs (University of Florida and Auburn for the Florida
       Building Commission 2023, 768 roofs). So their multiple stays low for ten years and rises after, as fasteners back
       out and underlayment and battens age (the rise is a judgment). Scaled the same way. */
    ageHard: a => (a <= 10 ? 0.4 : a <= 25 ? 0.4 + (a - 10) * 0.1 : 1.9),
    /* and against hail: weathered shingles and membranes grow brittle (RICOWI's Dallas survey rated shingles over 9 years
       old at twice the damage of newer ones; Haag); tile and steel do not change with age */
    hailAge: a => (a <= 5 ? 0.6 : a < 9 ? 0.6 + (a - 5) * 0.1 : a < 15 ? 1 + (a - 9) * 0.5 / 6 : 1.5),
    /* wind at the roof: taller buildings stand in faster air (ASCE 7 exposure coefficients, judgment on the step) */
    tall: st => (st >= 3 ? 1.2 : st === 2 ? 1.1 : 1),
    /* The storm record. recFrom: the first year the file resolves storm by storm at each ZIP (its footprints begin with
       Andrew in 1992; no storm reached Louisiana in 1990 or 1991). longFrom, longTo: the years the atlas counted for each
       ZIP's storm years (hur64, hur50: 76 years). femaFrom: the first year of FEMA's registrations in the atlas; before
       it module 17's storm replacements are the wind curve's. nearKm, own: each ZIP's record is steadied by the ZIPs within 40 km,
       by their roofs, because where a storm's core passed is partly luck and FEMA's counts lean on who registered.
       shrink: the years of evidence the state's mean cost of a storm year is worth beside a neighbourhood's own. */
    recFrom: 1990, femaFrom: 2004, longFrom: 1950, longTo: 2025, nearKm: 40, own: 0.6, shrink: 2,
  };
  /* the kinds of roof the outlook tells apart. life: the clock's key (LIFE); wind: against shingles (SMAT); ageK: how
     much of the shingles' ageing against wind the covering shares, or 'hard' for metal, tile and slate, which follow
     OC.ageHard. Their wind factors are a judgment between the 0.45 the roof clock above uses for metal homes (which it
     keeps, itself a judgment) and what Ian showed for metal and tile, about a fifth of the shingles' hazard past five
     years; nothing was found on slate in hurricanes, which is taken with tile; hail: against shingles on a 1 inch day and on a 1.75 inch day, from Haag
     Engineering's threshold sizes (3 tab shingles 1 inch, laminated 1.25, clay tile and gray slate 1.5, concrete tile
     and green slate 1.75, membranes 1 to 2, steel panels 2.5: they dent sooner, with the coating whole); hailK: how much of the
     shingles' ageing against hail it shares; leak: repair calls against the survey's rate; what each cause does to it. */
  const RTYPE = {
    shingle: { l: 'Asphalt shingles', s: 'shingles', life: 'shingle', wind: 1, ageK: 1, hail: [1, 1], hailK: 1, leak: 1, algae: 1, rust: 0,
      does: { hur: 'Hip and ridge caps go first; tabs lift, crease and blow off, in the middle of a slope about as often as along its edges; at hurricane force whole slopes strip to the underlayment and decking can follow', ts: 'Lifted and creased tabs, missing shingles along edges and the ridge, limbs through the deck', hail: 'Bruises that crack the mat under the granules, granule loss in spatters, cracked or punctured shingles from the larger stones; dents in vents and flashing mark the size', wear: 'Granules wash off, the asphalt dries and cracks, tabs curl and blister; the south and west slopes go first in this heat', leak: 'Leaks at pipe boots, wall and chimney flashing, valleys and nail pops', algae: 'Dark streaks of blue green algae, first on the north and shaded slopes', rust: '' } },
    metal: { l: 'Metal (standing seam or panels)', s: 'metal', life: 'metal', wind: 0.3, ageK: 'hard', hail: [0.03, 0.15], hailK: 0, leak: 0.7, algae: 0.15, rust: 1,
      does: { hur: 'Panels peel at the eaves, rakes and ridge where clips or screws let go; ridge caps and trim strip; exposed fastener panels tear at the screws', ts: 'Trim and ridge caps lift, a panel edge peels, limbs dent or pierce panels', hail: 'Dents that leave the coating whole, which a policy with a cosmetic damage exclusion does not pay for; it takes hail of about 2.5 inches to split a panel or open a lap', wear: 'On exposed fastener roofs screws back out and their washers dry and split; paint chalks and fades; sealant at laps and penetrations fails', leak: 'Leaks at screws, laps, ridge and pipe boots', algae: 'Dirt and mildew film on shaded panels', rust: 'Red rust at cut edges, laps, scratches and fasteners; salt air near the Gulf speeds it, and makers do not warrant the coating close to salt water' } },
    tile: { l: 'Clay or concrete tile, slate', s: 'tile or slate', life: 'tile', wind: 0.3, ageK: 'hard', hail: [0.1, 0.85], hailK: 0, leak: 1.1, algae: 0.6, rust: 0,
      does: { hur: 'Tiles and slates lift, slide and break at the eaves, hips and ridge; loose pieces become missiles that break more; mortar set ridge and hip tiles fail first', ts: 'Broken and slipped tiles or slates, mostly at edges and under trees', hail: 'Cracked and broken tiles and slates from hail of 1.5 to 1.75 inches and up; corners and exposed edges go first', wear: 'The underlayment and the fasteners age out long before the tile or slate does: slipped pieces, rusted nails, felt that no longer sheds water', leak: 'Leaks where the underlayment has worn through, at valleys, flashing and slipped pieces', algae: 'Mildew, lichen and moss on shaded slopes', rust: '' } },
    mh: { l: 'Manufactured home roof', s: 'manufactured home roofs', life: 'mh', wind: SMAT.mh, ageK: 1, hail: [0.8, 0.9], hailK: 0.6, leak: 1.3, algae: 0.6, rust: 0.6,
      does: { hur: 'Metal roof sheets peel from the edges and the roof over tears off; on pitched double wides shingles strip as on a house, sooner, because the decks are lighter', ts: 'Edge sheets and trim peel, a roof over lifts, limbs break through', hail: 'Dented and punctured sheet metal, cracked coatings, bruised shingles on pitched roofs', wear: 'Seams and fasteners open, coatings chalk and crack, the roof over sags and ponds', leak: 'Leaks at seams, vents and the marriage line', algae: 'Mildew and algae on coatings and shingles', rust: 'Rust at seams, fasteners and edges of sheet metal roofs' } },
    low: { l: 'Low slope membrane', s: 'low slope membranes', life: 'low', wind: SMAT.low, ageK: 0.6, hail: [0.15, 0.6], hailK: 0.8, leak: 1.4, algae: 0.3, rust: 0,
      does: { hur: 'The membrane peels from the corners and edges once the edge metal or a flashing lets go; gravel scours; rooftop units shift and tear their curbs', ts: 'Edge metal and flashing lift, a corner peels, debris punctures the membrane', hail: 'Fractured or punctured membrane (thermoplastic sheets from 1 to 2 inch hail, modified bitumen from 1.5 to 2, sooner when weathered or over soft insulation), crushed insulation under it, split base flashing', wear: 'Seams open, flashings pull from walls and curbs, the membrane shrinks, cracks and blisters; ponding water speeds all of it', leak: 'Leaks at seams, drains, curbs and wall flashings; wet insulation under the membrane', algae: 'Dirt and growth that darken a white membrane and raise its temperature', rust: '' } },
    mbldg: { l: 'Metal building roof', s: 'metal building roofs', life: 'mbldg', wind: SMAT.mbldg, ageK: 'hard', hail: [0.03, 0.15], hailK: 0, leak: 1.2, algae: 0.1, rust: 1,
      does: { hur: 'Panels peel from the eave and rake, ridge caps and gutters strip, skylight panels shatter', ts: 'Trim, gutters and an edge panel lift; skylight panels crack', hail: 'Dents that leave the coating whole; fractured skylight panels; a split panel only from hail of about 2.5 inches', wear: 'Fasteners back out, washers and lap sealant fail, panels move at the laps', leak: 'Leaks at fasteners, laps, ridge, skylight panels and around units', algae: 'Dirt film', rust: 'Rust at eaves, laps, around units and at every scratch; faster in salt air' } },
  };
  RTYPE.lowmf = Object.assign({}, RTYPE.low, { life: 'lowmf', wind: SMAT.lowmf });
  /* tile and slate last far longer than shingles; what ages under them is the felt and the nails (module 17's "50 years or more") */
  if (!LIFE.tile) { LIFE.tile = { L: 55, k: 3, l: 'tile or slate' }; LIFE.tile.lam = LIFE.tile.L / lanczos(1 + 1 / LIFE.tile.k); SMAT.tile = 0.3; HMAT.tile = 0.6; }
  const CAUSES = [['hur', 'Hurricane and tropical storm wind'], ['ts', 'Thunderstorm wind and tornadoes'], ['hail', 'Hail'], ['wear', 'Heat, sun and age'], ['leak', 'Leaks and flashing']];
  const CAUSE_L = Object.fromEntries(CAUSES);
  /* Louisiana's roofs by age today (module 17), as shares: what a storm year's count is an average over */
  const AGE_MAX = 40;
  const AGEW = (() => { const H = (DATA.ts && DATA.ts.agehist) || [], w = new Float64Array(AGE_MAX + 1); let t = 0; for (let a = 0; a < H.length; a++) { const v = +H[a] || 0; w[Math.min(a, AGE_MAX)] += v; t += v; } if (!t) w.fill(1 / (AGE_MAX + 1)); else for (let a = 0; a <= AGE_MAX; a++) w[a] /= t; return w; })();
  /* by age, for a covering that shares k of the shingles' ageing (or 'hard': metal, tile and slate): the multiple of the
     wind hazard (w) and of the hail hazard (h), each scaled to average 1 over those ages */
  const GK = new Map(), kKey = k => (k === 'hard' ? 'hard' : (+k || 0).toFixed(2));
  function gFor(k) {
    const key = kKey(k), hard = key === 'hard'; let g = GK.get(key); if (g) return g; k = hard ? 0 : +k || 0; g = { w: new Float64Array(AGE_MAX + 1), h: new Float64Array(AGE_MAX + 1), H: new Map() }; let sw = 0, sh = 0;
    for (let a = 0; a <= AGE_MAX; a++) { g.w[a] = hard ? OC.ageHard(a) : 1 + (OC.age(a) - 1) * k; g.h[a] = 1 + (OC.hailAge(a) - 1) * k; sw += AGEW[a] * g.w[a]; sh += AGEW[a] * g.h[a]; }
    for (let a = 0; a <= AGE_MAX; a++) { g.w[a] /= sw || 1; g.h[a] /= sh || 1; } GK.set(key, g); return g;
  }
  /* a storm year that replaced the share d of the roofs standing: the hazard H at which roofs of Louisiana's ages, each
     taking it at its own multiple, average d (by bisection; -ln(1 - d) where age makes no difference) */
  function hazOf(d, g) {
    if (!(d > 0)) return 0; const q = clamp(Math.round(d * 2000), 1, 1900); let H = g.H.get(q); if (H !== undefined) return H; const dd = q / 2000; let lo = 0, hi = 80;
    for (let i = 0; i < 40; i++) { H = (lo + hi) / 2; let m = 0; for (let a = 0; a <= AGE_MAX; a++) m += AGEW[a] * (1 - Math.exp(-H * g.w[a])); if (m < dd) lo = H; else hi = H; }
    H = (lo + hi) / 2; g.H.set(q, H); return H;
  }
  /* that storm year on a roof of age a: the chance it is replaced, and the chance it is repaired */
  function stormOn(d, a, k) { const g = gFor(k), x = hazOf(d, g) * g.w[clamp(Math.round(a), 0, AGE_MAX)], r = 1 - Math.exp(-x), y = 1 - Math.exp(-x * OC.anyM); return [r, Math.min(1 - r, Math.max(y - r, 0.2 * r))]; }
  const windAgeK = (a, k) => gFor(k).w[Math.min(a, AGE_MAX)], hailAgeK = (a, k) => gFor(k).h[Math.min(a, AGE_MAX)];
  /* the Gulf's shore, from the atlas's own outline (about 210 m to a step): for salt air on metal */
  const GULF = (() => { const pts = []; try { pathRings(G0.outline).forEach(r => r.forEach(([la, lo]) => { if (la < 30.2 && lo > -93.9 && lo < -88.7 && !(lo < -93.55 && la > 29.85) && !(lo > -89.75 && la > 30.12)) pts.push([la, lo]); })); } catch (e) { /* no outline: no salt air */ } return pts; })();
  const coastMemo = new Map();
  function coastKm(la, lo) {
    if (!isN(la) || !isN(lo) || !GULF.length) return 999; const k = la.toFixed(4) + ',' + lo.toFixed(4); let v = coastMemo.get(k);   /* to about 10 m: the salt steps begin at half a kilometre */
    if (v === undefined) { let best = 1e18; const kx = Math.cos(rad(la)) * 111.32; for (const p of GULF) { const dy = (p[0] - la) * 110.9, dx = (p[1] - lo) * kx, d = dx * dx + dy * dy; if (d < best) best = d; } v = Math.sqrt(best); if (coastMemo.size > 20000) coastMemo.clear(); coastMemo.set(k, v); }
    return v;
  }
  /* salt air on steel: the years of coating life left against inland (ISO 9223: zinc goes several times faster in the first
     kilometres from salt water; makers void 55 percent aluminium zinc and paint warranties within about 450 m of it). Judgment on the steps. */
  const SALT = [0.4, 0.55, 0.75, 0.9, 1], saltIx = km => (km < 0.5 ? 0 : km < 2 ? 1 : km < 8 ? 2 : km < 25 ? 3 : 4), saltK = km => SALT[saltIx(km)];
  /* The record a ZIP's outlook draws on.
     Its storm years one by one since 1990, each with the share of roofs it replaced as the roof clock above counts it
     (stormsAt: from 2004 module 17's count, FEMA's verified roof and wind damage where FEMA has it and the storm's
     modelled wind through the damage curve elsewhere; before 2004 the curve, scaled here by curveK), steadied by the
     ZIPs within OC.nearKm.
     And the forty years before the footprints begin, from the atlas's count of the years since 1950 with winds of 50
     knots and of 64 knots at each ZIP (module 02's hur50 and hur64): each of those years is given the mean cost of a
     storm year of its strength in the resolved record, the neighbourhood's own mean drawn toward the state's. Years of
     34 to 49 knots before 1990 are taken at the resolved record's pace, because the older storms were rebuilt with a
     broader wind profile that counts more of them. */
  const N_REC = OC.longTo - OC.recFrom + 1, N_PRE = OC.recFrom - OC.longFrom, N_LONG = N_REC + N_PRE, BAND = kt => (kt >= 64 ? 2 : kt >= 50 ? 1 : 0);
  /* How FEMA's counts have compared with the wind curve, by the year's top wind (34 to 49 knots, 50 to 63, 64 to 79, 80
     and over): over every ZIP's storm years since FEMA's file begins that module 17 took from FEMA (the clock's share
     differs from the curve's by a fifth or more), the roofs FEMA's count replaced over the roofs the curve would have.
     Near 1 below hurricane force, about a half to three quarters above it: the curve was fitted on Katrina, Rita,
     Gustav, Ike and Isaac, and outside 2005 FEMA's counts for a hurricane year have run at 0.3 to 0.8 of it. The
     years before FEMA's file, which the clock reads from the curve alone, are scaled by it here. From 2004 a ZIP's year
     that FEMA did not cover is still the curve's, and cannot be told from one FEMA's count happens to match, so it is
     left as module 17 has it. */
  const BAND4 = kt => (kt >= 80 ? 3 : kt >= 64 ? 2 : kt >= 50 ? 1 : 0);
  let CURVEK = null;
  function curveK() {
    if (CURVEK) return CURVEK; const t = [[0, 0], [0, 0], [0, 0], [0, 0]];
    Z.forEach(z => { if (!(z.roofs > 0)) return; stormsAt(z.zip).forEach(s => { if (s.src !== 'atlas' || s.y < OC.femaFrom || s.y > OC.longTo || !s.list.length || !(s.dw > 0.0005) || Math.abs(s.d / s.dw - 1) < 0.2) return; const b = BAND4(s.list[0].kt); t[b][0] += s.d * z.roofs; t[b][1] += s.dw * z.roofs; }); });
    CURVEK = t.map(([c, w]) => (w > 0 ? clamp(c / w, 0.3, 1.2) : 1)); return CURVEK;
  }
  /* what a storm year cost a ZIP's roofs, for the outlook: the clock's share from FEMA's first year on, the scaled curve before */
  const costOf = s => clamp(s.y < OC.femaFrom && s.list.length ? s.dw * curveK()[BAND4(s.list[0].kt)] : s.d, 0, 0.95);
  /* a ZIP's own tropical storm years in the resolved record: the year, the share of roofs replaced, the top wind and its storm */
  const yearsOf = zip => stormsAt(zip).filter(s => s.y >= OC.recFrom && s.y <= OC.longTo && s.list.length && s.list[0].kt >= 34).map(s => ({ y: s.y, d: costOf(s), kt: s.list[0].kt, si: s.list[0].si, ver: s.y >= OC.femaFrom }));
  /* the state's mean cost of a storm year by its top wind (34 to 49 knots, 50 to 63, hurricane force), by roofs */
  let BANDS = null;
  function bandMeans() {
    if (BANDS) return BANDS; const t = [[0, 0], [0, 0], [0, 0]];
    Z.forEach(z => { if (!(z.roofs > 0)) return; yearsOf(z.zip).forEach(e => { const b = BAND(e.kt); t[b][0] += e.d * z.roofs; t[b][1] += z.roofs; }); });
    BANDS = t.map(([c, n], i) => (n > 0 ? c / n : [0.012, 0.06, 0.235][i])); return BANDS;
  }
  const EVTS = new Map();
  function eventsFor(zip) {
    let E = EVTS.get(zip); if (E) return E; const z = ZI[zip] || null, near = []; let W = 0;
    if (z && isN(z.lat)) Z.forEach(q => { if (q.zip === zip || !isN(q.lat) || !(q.roofs > 0)) return; if (Math.abs(q.lat - z.lat) > 0.5 || Math.abs(q.lon - z.lon) > 0.6) return; if (meters([z.lat, z.lon], [q.lat, q.lon]) > OC.nearKm * 1000) return; near.push(q); W += q.roofs; });
    const parts = near.length ? [[zip, OC.own]].concat(near.map(q => [q.zip, (1 - OC.own) * q.roofs / W])) : [[zip, 1]];
    const res = new Map(), cnt = [0, 0, 0], cost = [0, 0, 0]; let c64 = 0, c50 = 0;
    parts.forEach(([zp, w]) => { const q = ZI[zp];
      yearsOf(zp).forEach(e => { const b = BAND(e.kt); cnt[b] += w; cost[b] += w * e.d; if (e.d > 0) { const k = clamp(Math.round(e.d * 2000), 1, 1900); res.set(k, (res.get(k) || 0) + w); } });
      if (q) { c64 += w * (+q.hur64 || 0) / 100 * N_LONG; c50 += w * (+q.hur50 || 0) / 100 * N_LONG; } });
    const B = bandMeans(), mean = b => (cost[b] + OC.shrink * B[b]) / (cnt[b] + OC.shrink);
    /* the years before the footprints: hurricane force, 50 to 63 knots, 34 to 49 knots; each a cost and a count of years */
    const pre = [[mean(2), Math.max(0, c64 - cnt[2])], [mean(1), Math.max(0, (c50 - c64) - cnt[1])], [mean(0), cnt[0] * N_PRE / N_REC]];
    E = { res: [...res].map(([k, w]) => [k / 2000, w]), pre, cnt, cost, c64, c50, near: near.length }; EVTS.set(zip, E); return E;
  }
  /* by the roof's age, for a covering that shares k of the shingles' ageing: the yearly chance a hurricane or tropical storm
     replaces it, and repairs it, under each record */
  const HURA = new Map();
  function hurByAge(zip, k) {
    const key = zip + '|' + kKey(k); let h = HURA.get(key); if (h) return h; const g = gFor(k), E = eventsFor(zip), A = () => new Float64Array(AGE_MAX + 1), pre = { rep: A(), fix: A() };
    h = { long: { rep: A(), fix: A() }, recent: { rep: A(), fix: A() }, mid: { rep: A(), fix: A() } };
    const add = (o, d, w) => { if (!(w > 0) || !(d > 0)) return; const H = hazOf(d, g); for (let a = 0; a <= AGE_MAX; a++) { const x = H * g.w[a], r = 1 - Math.exp(-x), y = 1 - Math.exp(-x * OC.anyM); o.rep[a] += w * r; o.fix[a] += w * Math.min(1 - r, Math.max(y - r, 0.2 * r)); } };
    E.res.forEach(([d, w]) => add(h.recent, d, w)); E.pre.forEach(([d, n]) => add(pre, d, n));
    for (let a = 0; a <= AGE_MAX; a++) ['rep', 'fix'].forEach(f => { const r = h.recent[f][a]; h.long[f][a] = (r + pre[f][a]) / N_LONG; h.recent[f][a] = r / N_REC; h.mid[f][a] = (h.long[f][a] + h.recent[f][a]) / 2; });
    if (HURA.size > 4000) HURA.clear(); HURA.set(key, h); return h;
  }
  /* a ZIP's weather as yearly chances for a shingle roof of average age: replaced by a hurricane, repaired after one, damaged
     on a thunderstorm or tornado day, the hail days; under the long record, the resolved one and their mean */
  const HAZ = new Map();
  function hazardAt(zip) {
    let h = HAZ.get(zip); if (h) return h;
    const z = ZI[zip] || null, HB = hurByAge(zip, 1), avg = o => { let r = 0, f = 0; for (let a = 0; a <= AGE_MAX; a++) { r += AGEW[a] * o.rep[a]; f += AGEW[a] * o.fix[a]; } return { rep: r, fix: f }; };
    let n64 = 0, top = null; yearsOf(zip).forEach(e => { if (e.kt >= 64) n64++; if (!top || e.d > top.d || (e.d === top.d && e.kt > top.kt)) top = { si: e.si, kt: e.kt, y: e.y, d: e.d }; });   /* the costliest storm year, named for its strongest storm */
    const hd1 = z ? +z.hd1 || 0 : 0, hd175 = z ? +z.hd175 || 0 : 0, hd2 = z ? +z.hd2 || 0 : 0, wd50 = z ? +z.wd50 || 0 : 0, wd65 = z ? +z.wd65 || 0 : 0, td1 = z ? +z.td1 || 0 : 0;
    h = { zip, long: avg(HB.long), recent: avg(HB.recent), mid: avg(HB.mid), n64, n64long: z ? Math.round((+z.hur64 || 0) / 100 * N_LONG) : 0, top,
      ts: [wd50 * OC.ts[0][0], wd65 * OC.ts[1][0], td1 * OC.ts[2][0]], hailDays: [hd1, hd175, hd2], days: { wd50, wd65, td1 }, lat: z ? z.lat : null, lon: z ? z.lon : null };
    HAZ.set(zip, h); return h;
  }
  /* One kind of roof at one ZIP, fifteen years on, from a spread of chances over the roof's age today (d0). o.rec: 'mid'
     (the mean of the two storm records), 'recent' (1990 on) or 'long' (1950 on); o.st: stories; o.heat: how hard the sun
     works this roof against the average roof of its kind there (1: the same; the Scout Engine's reading of its planes
     supplies it, held between 0.5 and 1.6): its life shortens or stretches by the square root of that, because heat is one
     of several things that age a roof (judgment).
     The building is followed, not the roof stock: every case is a spread of chances over the age of the roof then on the
     building, and a replacement by anything puts it back at age zero. Beside every case (dist) the count keeps the cases
     where today's roof is still on (own), those where no roofer has been called (clean) and, cause by cause, those the
     cause has not touched yet (nc), has not replaced yet (nr) and has not repaired yet (nf). Out come, for each year 0 to
     15: the chance by then of each cause at least once (C), of a replacement by it (R) and of a repair after it (F); of
     any replacement (rep, one minus keep), of any call for a roofer (any), of today's roof still being on (keep); the
     mean age of the roof then in place (age), and the slow marks on that roof (alg; rust for each step of salt air).
     The count is linear in d0, so a building's many possible clock starts are blended into one spread for each covering
     first (outlookOf) and counted once. */
  /* what a year does to a roof of each age, for one kind of roof at one ZIP under one record, height and heat: for every
     cause the chance it replaces the roof (r) and the chance it is repaired after it (f); the chance nothing replaces
     it (stay), and that nothing touches it (none). The chances depend on the roof's age and not on the year, so the
     table is made once and every count reads it. */
  const QN = HMAX + OUT_Y + 6, QT = new Map();
  function chances(type, zip, rec, st, heat) {
    const key = [type, zip, rec, st, heat.toFixed(2)].join('|'); let q = QT.get(key); if (q) return q;
    const T = RTYPE[type] || RTYPE.shingle, hz = hazardAt(zip), HB = hurByAge(zip, T.ageK), HA = HB[rec] || HB.mid, p = LIFE[T.life] || LIFE.shingle, lam = p.lam / Math.pow(heat, 0.5), kk = p.k, S = a => Math.exp(-Math.pow(a / lam, kk)), wk = T.wind * OC.tall(st), CK = CAUSES.map(([c]) => c);
    const tsR = hz.ts[0] * OC.ts[0][1] + hz.ts[1] * OC.ts[1][1] + hz.ts[2] * OC.ts[2][1], tsF = hz.ts[0] * (1 - OC.ts[0][1]) + hz.ts[1] * (1 - OC.ts[1][1]) + hz.ts[2] * (1 - OC.ts[2][1]);
    const h1 = hz.hailDays[0] * OC.hail[0][0] * T.hail[0], h2 = hz.hailDays[1] * OC.hail[1][0] * T.hail[1], haR = h1 * OC.hail[0][1] + h2 * OC.hail[1][1], haF = h1 * (1 - OC.hail[0][1]) + h2 * (1 - OC.hail[1][1]);
    q = { CK, r: CK.map(() => new Float64Array(QN)), f: CK.map(() => new Float64Array(QN)), stay: new Float64Array(QN), none: new Float64Array(QN), hz };
    for (let a = 0; a < QN; a++) { const aa = Math.min(a, AGE_MAX), wa = windAgeK(a, T.ageK) * wk, ha = hailAgeK(a, T.hailK), sa = S(a);
      const x = { wear: [sa > 0 ? 1 - S(a + 1) / sa : 1, 0], hur: [clamp(HA.rep[aa] * wk, 0, 0.9), clamp(HA.fix[aa] * wk, 0, 0.9)], ts: [clamp(tsR * wa, 0, 0.5), clamp(tsF * wa, 0, 0.5)], hail: [clamp(haR * ha, 0, 0.5), clamp(haF * ha, 0, 0.5)], leak: [0, clamp(repRate(a) * T.leak, 0, 0.5)] };
      let stay = 1, none = 1; CK.forEach((c, i) => { let r = clamp(x[c][0], 0, 1), f = x[c][1]; if (r + f > 1) f = 1 - r; q.r[i][a] = r; q.f[i][a] = f; stay *= 1 - r; none *= 1 - r - f; }); q.stay[a] = stay; q.none[a] = none; }
    if (QT.size > 600) QT.clear(); QT.set(key, q); return q;
  }
  function count(type, zip, d0in, o) {
    o = o || {}; const rec = o.rec || CFG.outRec || 'mid', st = o.st || 1, heat = isN(o.heat) ? clamp(o.heat, 0.5, 1.6) : 1, Q = chances(type, zip, rec, st, heat), CK = Q.CK, NK = CK.length;
    let n0 = d0in ? Math.min(d0in.length, HMAX + 2) : 0; while (n0 > 1 && !d0in[n0 - 1]) n0--; if (n0 < 1) n0 = 1;
    const N = n0 + OUT_Y + 2, A0 = () => new Float64Array(N), d0 = A0(); if (d0in && d0in.length) { for (let a = 0; a < n0; a++) d0[a] = d0in[a]; } else d0[0] = 1;
    const copy = () => Float64Array.from(d0), tot = x => { let t = 0; for (let a = 0; a < N; a++) t += x[a]; return t; };
    let dist = copy(), own = copy(), clean = copy(), nc = CK.map(copy), nr = CK.map(copy), nf = CK.map(copy);
    const Z0 = () => new Float64Array(OUT_Y + 1), C = {}, Rr = {}, Fx = {}; CK.forEach(c => { C[c] = Z0(); Rr[c] = Z0(); Fx[c] = Z0(); });
    const rep = Z0(), any = Z0(), keep = Z0(), age = Z0(), alg = Z0(), rust = SALT.map(Z0); keep[0] = 1;
    const marks = t => { let am = 0, al = 0; const ru = SALT.map(() => 0); for (let a = 0; a < N; a++) { const v = dist[a]; if (!v) continue; am += v * a; al += v * ALG1[Math.min(a, QN - 1)]; for (let i = 0; i < SALT.length; i++) ru[i] += v * RUST1[i][Math.min(a, QN - 1)]; } age[t] = am; alg[t] = al; ru.forEach((x, i) => { rust[i][t] = x; }); };
    marks(0);
    for (let t = 1; t <= OUT_Y; t++) {
      const nd = A0(), no = A0(), ncl = A0(), nnc = CK.map(A0), nnr = CK.map(A0), nnf = CK.map(A0); let moved = 0;
      for (let a = 0; a < N - 1; a++) { const v = dist[a], stay = Q.stay[a];
        nd[a + 1] += v * stay; moved += v * (1 - stay); no[a + 1] += own[a] * stay; ncl[a + 1] += clean[a] * Q.none[a];
        for (let i = 0; i < NK; i++) { const r = Q.r[i][a], fx = Q.f[i][a], other = r < 1 ? Math.min(1, stay / (1 - r)) : 0;   /* other: no other cause replaces it this year */
          let w = nc[i][a] * (1 - r - fx); nnc[i][a + 1] += w * other; nnc[i][0] += w * (1 - other);
          w = nr[i][a] * (1 - r); nnr[i][a + 1] += w * other; nnr[i][0] += w * (1 - other);
          const on = fx < 1 ? Math.max(0, 1 - r / (1 - fx)) * other : 0; w = nf[i][a] * (1 - fx); nnf[i][a + 1] += w * on; nnf[i][0] += w * (1 - on); } }
      nd[0] += moved; dist = nd; own = no; clean = ncl; nc = nnc; nr = nnr; nf = nnf;
      keep[t] = tot(own); rep[t] = 1 - keep[t]; any[t] = 1 - tot(clean); CK.forEach((c, i) => { C[c][t] = 1 - tot(nc[i]); Rr[c][t] = 1 - tot(nr[i]); Fx[c][t] = 1 - tot(nf[i]); });
      marks(t);
    }
    return { type, zip, C, R: Rr, F: Fx, rep, any, keep, age, alg, rust, rec, hz: Q.hz };
  }
  /* the same for a roof whose clock started in y0 (its ages today from the roof clock), or one exactly THIS_YEAR - y0
     years old (o.exact: for the table by kind of roof and the tests) */
  const FWD = new Map();
  function forward(type, zip, y0, o) {
    o = o || {}; const rec = o.rec || CFG.outRec || 'mid', st = o.st || 1, heat = isN(o.heat) ? clamp(o.heat, 0.5, 1.6) : 1, T = RTYPE[type] || RTYPE.shingle, key = [type, zip, y0, rec, st, heat.toFixed(2), o.exact ? 'x' : ''].join('|');
    let f = FWD.get(key); if (f) return f;
    const d0 = o.exact ? (() => { const d = new Float64Array(clamp(THIS_YEAR - y0, 0, HMAX) + 2); d[clamp(THIS_YEAR - y0, 0, HMAX)] = 1; return d; })() : (rstate(T.life, zip, y0) || {}).dist;
    f = count(type, zip, d0, { rec, st, heat }); if (FWD.size > 1500) FWD.clear(); FWD.set(key, f); return f;
  }
  /* several of those, weighted: a building's mix of coverings and of years its clock may have started in. si: the step of
     salt air the building stands in, for rust. */
  function blend(parts, si) {
    const Z0 = () => new Float64Array(OUT_Y + 1), o = { C: {}, R: {}, F: {}, rep: Z0(), any: Z0(), keep: Z0(), age: Z0(), alg: Z0(), rust: Z0() }; CAUSES.forEach(([c]) => { o.C[c] = Z0(); o.R[c] = Z0(); o.F[c] = Z0(); }); let W = 0; si = clamp(si == null ? SALT.length - 1 : si, 0, SALT.length - 1);
    parts.forEach(([f, w]) => { if (!f || !(w > 0)) return; W += w; for (let t = 0; t <= OUT_Y; t++) { CAUSES.forEach(([c]) => { o.C[c][t] += f.C[c][t] * w; o.R[c][t] += f.R[c][t] * w; o.F[c][t] += f.F[c][t] * w; }); o.rep[t] += f.rep[t] * w; o.any[t] += f.any[t] * w; o.keep[t] += f.keep[t] * w; o.age[t] += f.age[t] * w; o.alg[t] += f.alg[t] * w; o.rust[t] += f.rust[si][t] * w; } });
    if (W > 0) for (let t = 0; t <= OUT_Y; t++) { CAUSES.forEach(([c]) => { o.C[c][t] /= W; o.R[c][t] /= W; o.F[c][t] /= W; }); o.rep[t] /= W; o.any[t] /= W; o.keep[t] /= W; o.age[t] /= W; o.alg[t] /= W; o.rust[t] /= W; }
    o.W = W; return o;
  }
  /* algae on a roof of age a (a chance its streaks show). The Gulf states are where shingle algae is most widespread, and
     it shows first on north slopes (ARMA and makers' bulletins); how soon it shows was not found in any source, and
     algae resistant shingles carry warranties of 10 to 25 years. The curve (half of unprotected shingle roofs streaked
     by about thirteen years) is a judgment, grade D. slopeK: 1.6 shaded or north, 0.6 full sun. */
  const algaeAt = (a, typeK, slopeK) => clamp(typeK, 0, 1) * (1 - Math.exp(-Math.pow(Math.max(0, a) / (15 / Math.sqrt(slopeK || 1)), 2.5)));
  /* rust that needs a roofer on a steel roof of age a, with salt air (a Weibull on the coating and fastener life: 32 years
     inland; judgment, grade D). km is the distance to the Gulf's open shore, the only salt water the model sees: not Lake
     Pontchartrain, the bays or the marsh canals, which the makers' warranties also count. */
  const rustOn = (a, k) => 1 - Math.exp(-Math.pow(Math.max(0, a) / (32 * k), 3));
  const rustAt = (a, typeK, km) => clamp(typeK, 0, 1) * rustOn(a, saltK(km));
  /* both by age, once, for the count: algae on an unprotected roof in average light, rust at each step of salt air */
  const ALG1 = Float64Array.from({ length: QN }, (_, a) => algaeAt(a, 1, 1)), RUST1 = SALT.map(k => Float64Array.from({ length: QN }, (_, a) => rustOn(a, k)));
  /* the kinds of roof a building may carry, with their odds: the clock's coverings, and for a house the few percent of tile or slate */
  function typesOf(b) {
    const rf = b.roof || {}, keys = rf.keys || []; if (!keys.length) return [];
    const house = keys.length === 2 && keys[0][0] === 'shingle' && keys[1][0] === 'metal' && (b.cls === 'sf' || (b.cls === 'mf' && (rf.units || 0) <= 4));
    if (!house) return keys.map(([k, w]) => [k, w]);
    const sh = keys[0][1], tile = sh * 0.04; return [['shingle', sh - tile], ['metal', keys[1][1]], ['tile', tile]];
  }
  /* a building's outlook: its own mix (b.mix: covering, year the clock started, weight) blended, for each covering, into
     one spread of roof ages today and counted once; the coverings blended; each kind of roof it may carry, apart; and the
     slower marks on the roof then in place. o.rec, o.heat as in count; without o.heat, the heat the Scout Engine last
     read for this roof (b.heatK), so the card and the roof views say the same thing. A ZIP with no row in the atlas has
     no weather on record here, so no outlook. The result is kept on the building until its mix is read again. */
  function outlookOf(b, o) {
    o = o || {}; const zip = b.zip || b.zipF || '', mix = b.mix || [], types = typesOf(b); if (!mix.length || !types.length || !zip || !ZI[zip]) return null;
    const st = b.cls === 'sf' || b.cls === 'mf' || b.cls === 'mh' || b.cls === 'garage' || b.cls === 'shed' ? storiesRes(b.h) : Math.min(3, floorsCom(b.h)), opt = { rec: o.rec || CFG.outRec || 'mid', st, heat: o.heat != null ? o.heat : b.heatK };
    const mk = [opt.rec, st, isN(opt.heat) ? clamp(opt.heat, 0.5, 1.6).toFixed(2) : '1'].join('|'); if (b._o && b._o.mix === mix && b._o.key === mk) return b._o.O;
    const tw = Object.fromEntries(types), km = coastKm(b.lat, b.lon), si = saltIx(km), starts = {}, LEN = HMAX + 2;
    /* each covering's spread of roof ages today, over the years its clock may have started in */
    const start = (k, y, w) => { if (!(w > 0) || !RTYPE[k]) return; const d = (rstate(RTYPE[k].life, zip, y) || {}).dist; let s2 = starts[k]; if (!s2) s2 = starts[k] = { d: new Float64Array(LEN), w: 0 }; if (d) { for (let a = 0, n = Math.min(d.length, LEN); a < n; a++) s2.d[a] += d[a] * w; } else s2.d[0] += w; s2.w += w; };
    mix.forEach(([k, y, w]) => { if (k === 'shingle' && tw.tile > 0) { const sh = tw.tile / (tw.tile + tw.shingle); start('shingle', y, w * (1 - sh)); start('tile', y, w * sh); } else start(k, y, w); });
    const parts = [], per = {}, tail = new Float64Array(LEN + 1); let PW = 0;
    Object.keys(starts).forEach(k => { const s2 = starts[k]; if (!(s2.w > 0)) return; for (let a = 0; a < LEN; a++) s2.d[a] /= s2.w; const f = count(k, zip, s2.d, opt); parts.push([f, s2.w]); per[k] = f; PW += s2.w; let run = 0; for (let a = LEN - 1; a >= 0; a--) { tail[a] += s2.w * run; run += s2.d[a]; } });
    if (!(PW > 0)) return null; for (let a = 0; a <= LEN; a++) tail[a] /= PW;   /* tail[n]: the chance today's roof is more than n years old */
    const all = blend(parts, si), hz = hazardAt(zip);
    const byType = types.map(([k, w]) => ({ k, w, l: RTYPE[k].l, o: per[k] ? blend([[per[k], 1]], si) : null })).filter(x => x.o && x.o.W > 0);
    /* the slower marks by year, on the roof then in place: over the kinds of roof the building may carry (slow), and for a
       kind taken alone, RTYPE[k].algae or .rust times that kind's o.alg or o.rust */
    const slow = { algae: new Float64Array(OUT_Y + 1), rust: new Float64Array(OUT_Y + 1) }; let TW = 0; byType.forEach(r => { TW += r.w; });
    if (TW > 0) for (let t = 0; t <= OUT_Y; t++) { let al = 0, ru = 0; byType.forEach(r => { const T = RTYPE[r.k]; al += r.w * T.algae * r.o.alg[t]; ru += r.w * T.rust * r.o.rust[t]; }); slow.algae[t] = al / TW; slow.rust[t] = ru / TW; }
    const older = n => tail[clamp(Math.floor(+n || 0), 0, LEN)];
    const O = { zip, all, byType, slow, hz, km, st, rec: opt.rec, types, heat: isN(opt.heat) ? opt.heat : null, older };
    b._o = { mix, key: mk, O }; return O;
  }
  /* the causes in order at a year. Wind is one cause here, as on the chart, the roofs and their labels: hurricanes and
     tropical storms with thunderstorms and tornadoes (taken as independent of each other); sub says which of the two is
     the larger, and names the words for what it does to each covering */
  const WIND_FROM = { hur: 'hurricanes and tropical storms', ts: 'thunderstorms and tornadoes' };
  const causeRank = (O, t) => { const either = (x, y) => 1 - (1 - x) * (1 - y), hur = O.C.hur[t], ts = O.C.ts[t];
    return [{ c: 'wind', sub: hur >= ts ? 'hur' : 'ts', l: 'Wind', p: either(hur, ts), rep: either(O.R.hur[t], O.R.ts[t]), fix: either(O.F.hur[t], O.F.ts[t]) }].concat(['hail', 'wear', 'leak'].map(c => ({ c, sub: c, l: CAUSE_L[c], p: O.C[c][t], rep: O.R[c][t], fix: O.F[c][t] }))).sort((x, y) => y.p - x.p); };
  const causeText = k => (k.c === 'wind' ? 'wind, most of it from ' + WIND_FROM[k.sub] : k.l.toLowerCase());
  const causeShort = k => (k.c === 'wind' ? 'wind (' + WIND_FROM[k.sub] + ')' : k.l.toLowerCase());
  /* one kind of roof of a given age at a ZIP, with no building under it: for the table by kind of roof */
  function outlookType(type, zip, ageYears, o) { return forward(type, zip, Math.round(THIS_YEAR - clamp(ageYears, 0, 60)), Object.assign({ exact: true }, o || {})); }

