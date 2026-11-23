  /* the weight a permit carries for one building: its text's weight, times its share when several buildings share its address */
  const permitE = p => (p.w || 0) * (p.share || 1);
  const isReroof = p => p.kind !== 'newc' && permitE(p) >= 0.6;
  /* CAL FIRE's damage classes, as chances the roof needs a roofer */
  const DINS_W = { 'Destroyed (>50%)': 1, 'Major (26-50%)': 0.85, 'Major (25-50%)': 0.85, 'Minor (10-25%)': 0.55, 'Affected (1-9%)': 0.3, 'Affected (>0-10%)': 0.3 };
  const dinsClass = d => (/^Destroyed/i.test(d) ? 'destroyed' : /^Major/i.test(d) ? 'major damage' : /^Minor/i.test(d) ? 'minor damage' : /^Affected/i.test(d) ? 'affected' : /^No Damage/i.test(d) ? 'no damage' : /^Inaccessible/i.test(d) ? 'inaccessible' : String(d || '').toLowerCase());
  const dinsW = d => (/^Destroyed/i.test(d) ? 1 : /^Major/i.test(d) ? 0.85 : /^Minor/i.test(d) ? 0.55 : /^Affected/i.test(d) ? 0.3 : 0);
  /* the share of destroyed homes that come back with a new roof (the atlas's rebuild share; module 17) */
  const FIRE_RB = clamp(+ANCH.fire_rb || 0.6, 0.1, 1);
  function read(b) {
    /* the start of the clock: the year built on file, or the ZIP's mix of years */
    let starts, prior = null;
    if (b.yb) { starts = [[b.yb, 1]]; b.ybMid = b.yb; b.prior = null; }
    else { prior = ybPrior(b); starts = []; prior.forEach((w, i) => { if (w > 1e-4) sampleYears(i).forEach(y => starts.push([y, w / 3])); }); b.ybMid = Math.round(sum(starts.map(s => s[0] * s[1]))); b.prior = prior; }
    /* the covering on record, newest evidence first: the words of the last strong roof permit, CAL FIRE's inspection (when
       the building was not destroyed), the assessor's roll (Riverside) */
    const rpAll = b.permits.filter(p => p.kind !== 'newc' && p.w >= 0.3).sort((x, y) => x.y - y.y);
    const lastCov = rpAll.filter(p => p.cov && permitE(p) >= 0.6).pop();
    const dz = b.dins || null, burned = dz && /^Destroyed/i.test(dz.dmg) ? dz : null;
    b.cover = lastCov ? Object.assign({ src: 'permit', at: lastCov.d }, lastCov.cov) : dz && !burned && dinsRoof(dz.roof) ? { k: dinsRoof(dz.roof), src: 'dins', at: dz.d } : b.parcel && b.parcel.roofK ? { k: b.parcel.roofK, src: 'roll', raw: b.parcel.roof } : null;
    b.roof = roofOf(b);
    const rf = b.roof, keys = rf.keys || [];
    const zip = b.zip || b.zipF || '';
    const stateFrom = list => keys.length ? mixStates(list.flatMap(([y, w]) => keys.map(([k, kw]) => [rstate(k, zip, Math.min(THIS_YEAR, Math.round(y))), w * kw]))) : Object.assign({}, ZERO);
    let st = stateFrom(starts);
    /* the same mix as a list (covering, the year the clock started, weight), for the outlook's years ahead */
    const mixOf = list => list.flatMap(([y, w]) => keys.map(([k, kw]) => [k, Math.min(THIS_YEAR, Math.round(y)), w * kw])); let mix = mixOf(starts);
    /* roof permits, oldest first: each restarts the clock by its weight, so a re-roof followed by a repair keeps both. The
       builder's roof is still on only if no permit replaced it (pOrig); pPerm is the chance the roof of the last strong
       permit (weight 0.6 or more) is still on, worn down by any weaker permit after it. A structure CAL FIRE recorded as
       destroyed is read the same way: if it was rebuilt (the atlas's rebuild share), its roof dates from about two years
       after the fire. */
    const rp = rpAll.slice();
    if (burned && burned.y && NOW - burned.y > 1.5 && !b.permits.some(p => p.y > burned.y && (isReroof(p) || p.kind === 'newc'))) rp.push({ kind: 'rebuild', y: Math.min(NOW, burned.y + 2), d: '', w: FIRE_RB, share: 1, desc: 'Rebuilt after the ' + burned.inc + ' fire', src: 'CAL FIRE damage inspection' });
    rp.sort((x, y) => x.y - y.y);
    const strong = rp.filter(p => permitE(p) >= 0.6).pop() || null;
    if (keys.length) rp.forEach(p => { const w = permitE(p), fresh = stateFrom([[Math.floor(p.y), 1]]), o = {}; ST_KEYS.forEach(k => o[k] = w * fresh[k] + (1 - w) * st[k]); o.pOrig = (1 - w) * st.pOrig; o.pPerm = p === strong ? w * fresh.pOrig : (1 - w) * (st.pPerm || 0); const sy = new Map(); [[fresh, w], [st, 1 - w]].forEach(([s, ww]) => (s.fires || []).forEach(x => { const e = sy.get(x.y) || Object.assign({}, x, { share: 0 }); e.share += x.share * ww; sy.set(x.y, e); })); o.fires = [...sy.values()].sort((a, c) => c.share - a.share).slice(0, 3); st = o; mix = mixOf([[Math.floor(p.y), 1]]).map(m => [m[0], m[1], m[2] * w]).concat(mix.map(m => [m[0], m[1], m[2] * (1 - w)])); });
    const last = rp.length ? rp[rp.length - 1] : null;
    b.state = st; b.last = last && last.kind !== 'rebuild' ? last : (rpAll.length ? rpAll[rpAll.length - 1] : null); b.lastW = b.last ? permitE(b.last) : null; b.strong = strong;
    { const m = new Map(); mix.forEach(([k, y, w]) => { if (w > 1e-5) m.set(k + '|' + y, (m.get(k + '|' + y) || 0) + w); }); b.mix = [...m].map(([k, w]) => { const [kk, y] = k.split('|'); return [kk, +y, w]; }); }
    /* wind and hail since the roof went on: NOAA and Weather Service reports within 5 km in the last three years; a re-roof
       permit after the event closes most of it, and nothing from before a building's year on file counts. Reports of one
       storm (hail, or wind and tornadoes, in the same month and on the same weekday within three hours) count once, at
       the strongest: reports cluster in towns and along roads. */
    const ev = eventsNear(b.lat, b.lon); b.ev = ev;
    const born = b.yb && (b.ybSrc === 'parcel' || b.ybSrc === 'permit' || b.ybSrc === 'dins') ? b.yb : null;
    const hm = keys.reduce((s, [k, w]) => s + ((RTYPE[k] || RTYPE.shingle).hail[0]) * w, 0) || 0, wm = keys.reduce((s, [k, w]) => s + ((RTYPE[k] || RTYPE.shingle).wind) * w, 0) || 0;
    const after = t => b.permits.some(p => (isReroof(p) || p.kind === 'newc') && p.y > t);
    let keepW = 1, windTop = null; const days = [];
    ev.forEach(e => {
      if (born && e.t < born) return;
      const g = e.k === 0 ? 0 : 1, d = g === 0 ? hailDmg(e.mag) * clamp(1 - e.km / 5, 0, 1) * recency(e.ago) * hm * (after(e.t) ? 0.15 : 1) : windDmg(e) * clamp(1 - e.km / (e.k === 2 ? 1.5 : 3), 0, 1) * recency(e.ago) * wm * (after(e.t) ? 0.15 : 1);
      if (!(d > 0)) return;
      const o = days.find(x => x.g === g && x.e.y === e.y && x.e.m === e.m && x.e.dw === e.dw && Math.abs((+x.e.h || 0) - (+e.h || 0)) <= 3);
      if (!o) days.push({ g, e, d }); else if (d > o.d) { o.e = e; o.d = d; }
    });
    days.forEach(({ e, d }) => { keepW *= 1 - d; if (!windTop || d > windTop.d) windTop = { e, d }; });
    const WIND = keys.length ? clamp(1 - keepW, 0, 0.6) : 0;
    /* fire: CAL FIRE's inspection of this building in the last four years (a destroyed home is a rebuild roof at the
       atlas's rebuild share, spread over the four years after the fire; a damaged roof a repair or a replacement, most of
       it closed within three years or by a later permit) */
    let FIRE = 0;
    if (dz && dz.y && keys.length) { const ago = NOW - dz.y, w0 = dinsW(dz.dmg); if (burned) FIRE = ago <= 4.5 && !after(dz.y) ? FIRE_RB * clamp(1 - Math.max(0, ago - 1) / 4, 0.15, 1) : 0; else if (w0 > 0) FIRE = w0 * recency(Math.max(0, ago)) * (after(dz.y) ? 0.15 : 1); }
    FIRE = clamp(FIRE, 0, 0.9);
    const P5 = keys.length ? st.p5 : 0, REP = keys.length ? st.rep : 0;
    const need = clamp((1 - (1 - P5) * (1 - REP) * (1 - WIND) * (1 - FIRE)) * rf.factor, 0, 1);
    b.sc = { P5, REP, WIND, FIRE, HAIL: 0, need, score: Math.round(need * 100), windTop };
    /* what the work most likely is */
    const opts = [['replace', P5], ['repair', REP * 1.5], ['storm', WIND * 1.4], ['fire', FIRE * 1.6]].sort((x, y) => y[1] - x[1]);
    let nk = !keys.length || rf.factor < 0.1 ? 'none' : opts[0][0];
    const tileTop = rf.mat === 'tile'; if (nk === 'replace' && tileTop) nk = 'tile';
    const reset = !!strong, permAge = reset ? Math.round(NOW - strong.y) : 0;
    const topF = (st.fires || [])[0];
    /* the builder's roof: its chance (pOrig, which no permit raises) and the building's age, not the clock's */
    const original = !reset && st.pOrig >= 0.35 && THIS_YEAR - (b.yb || b.ybMid || THIS_YEAR) >= 15;
    const wl = windTop ? `Wind or hail damage: ${evLabel(windTop.e)} reported ${D(windTop.e.km, 1)} km ${windTop.e.dir}, ${evWhen(windTop.e)}` : 'Wind or hail damage';
    const fl = dz ? (burned ? `Fire rebuild: CAL FIRE recorded this structure destroyed in the ${dz.inc} fire (${dz.d ? monthYear(dz.d) : Math.floor(dz.y)})` : `Fire damage: CAL FIRE recorded ${dinsClass(dz.dmg)} here in the ${dz.inc} fire (${dz.d ? monthYear(dz.d) : Math.floor(dz.y)})`) : 'Fire damage';
    b.need = { k: nk, l: nk === 'tile' ? (reset && permAge >= 12 ? `Tile lift and relay: the underlayment laid around ${Math.floor(strong.y)} is about ${permAge} years old` : original && st.pOld25 >= 0.4 ? 'Tile lift and relay: the original underlayment is likely, and 25 years or older' : 'Tile lift and relay: new underlayment under the same tile')
      : nk === 'replace' ? (reset && permAge >= 12 ? `Replacement: the roof put on around ${Math.floor(strong.y)} is about ${permAge} years old` : original ? 'Replacement: the builder\'s original roof is likely' : topF && topF.share >= 0.25 && THIS_YEAR - topF.y >= 13 ? `Replacement: a roof from the ${topF.y} fire rebuild is likely` : st.pOld20 >= 0.4 ? 'Replacement: a roof 20 years or older is likely' : 'Replacement')
      : nk === 'repair' ? 'Repair: leaks, worn flashing or a tired section' : nk === 'storm' ? wl : nk === 'fire' ? fl : 'No roofing work expected' };
    /* the atlas's service lines it falls under, by segment as module 12 counts them: manufactured homes and buildings of
       five or more units only in their own lines, commercial roofs in the commercial and coating lines, one to four unit
       homes in the residential lines with the top need's line first */
    const L = [], add = id => { if (!L.includes(id) && SLM.LI && SLM.LI[id]) L.push(id); };
    const resi = b.cls === 'sf' || b.cls === 'garage' || b.cls === 'shed' || (b.cls === 'mf' && (rf.units || 0) <= 4), bigMF = b.cls === 'mf' && (rf.units || 0) > 4;
    const comm = !resi && !bigMF && b.cls !== 'mh' && keys.length > 0, lowRoof = rf.mat === 'low' || rf.mat === 'mbldg';
    const zoneHi = b.fhsz ? b.fhsz.cls >= 2 : !!(b.z && wxCol(b.z, 'fhszHV') >= 50);
    if (b.cls === 'mh') add('mh');
    else if (bigMF) add('mf');
    else if (comm) { add(nk === 'repair' && lowRoof ? 'coat' : 'comm'); if (lowRoof && st.age >= 8 && st.pOld20 < 0.55) add('coat'); }
    else if (resi && keys.length) {
      if (FIRE >= 0.04) add('fire');
      if (WIND >= 0.04) add('storm');
      if (nk === 'replace' || nk === 'tile') { add(nk === 'tile' ? 'tile' : rf.metalP >= 0.5 ? 'metal' : 'replace'); if (nk !== 'tile' && rf.tileP >= 0.25) add('tile'); if (zoneHi && b.cls === 'sf') add('harden'); if (rf.metalP < 0.5 && rf.metalP >= 0.15) add('metal'); if (CK[b.id] && (CK[b.id].cues || []).includes('solar')) add('solar'); }
      if (REP >= 0.03) add('repair');
      if (zoneHi && b.cls === 'sf') add('harden');
      const first = nk === 'tile' ? 'tile' : nk === 'replace' ? (rf.metalP >= 0.5 ? 'metal' : 'replace') : nk, i = L.indexOf(first); if (i > 0) { L.splice(i, 1); L.unshift(first); }
    }
    if (b.permits.some(p => p.kind === 'newc' && NOW - p.y < 1.5)) add('newc');
    b.lines = L.slice(0, 4);
    statusOf(b);
    return b;
  }
