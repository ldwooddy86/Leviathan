  /* CAL FIRE's damage inspections by roof covering: residences in incidents of 2018 and later (the years undamaged homes
     were recorded too), the share recorded as destroyed and the count. Raw shares: not adjusted for how hard each fire
     burned, how close the houses stood, vegetation, defence or the age of the house; "Unknown" is a tenth of the rows,
     and three fires (Camp, Eaton, Palisades) supply two fifths of them. The page's data is read first if it carries the table. */
  const DINS_ROOF = (DATA.roof_hazard && DATA.roof_hazard.dins_roof) || (META.roof_hazard && META.roof_hazard.dins_roof) || { shingle: [0.595, 42319, 'asphalt'], metal: [0.534, 11136, 'metal'], tile: [0.321, 9326, 'tile'], wood: [0.585, 554, 'wood'], concrete: [0.400, 718, 'concrete'] };
  const dinsLine = k => { const r = DINS_ROOF[k === 'flat' || k === 'low' || k === 'lowmf' || k === 'mh' ? 'shingle' : k === 'mbldg' ? 'metal' : k] || null; return r ? `${pct(1 - r[0])} of the ${N(r[1])} inspected homes with ${r[2]} roofs were not destroyed` : ''; };

  /* what the lens holds for one building: everything that does not change from corner to corner */
  function lensBegin(lens, b, ctx) {
    if (!b || !b.roof || !b.sc) return null; const types = typesOf(b); if (!types.length) return null;
    ctx = ctx || {}; const la = b.lat, lo = b.lon, zip = b.zip || b.zipF || '', opt = optOf(types, ctx.lum), low = b.roof.slope === 'low', year = clamp(Math.round(+ctx.year || 0), 0, OUT_Y);
    const ref = types.reduce((s, [k, w]) => s + heatRef(k, la, lo) * w, 0) / types.reduce((s, [, w]) => s + w, 0);
    const hr = n => heatRate(opt.sr, opt.e, n, la, lo), R = { lens, b, types, opt, low, year, zip, la, lo, ref, hr, canopy: +ctx.canopy || 0, lum: ctx.lum, planes: [], wx: wxResolve(ctx) };
    /* the whole roof's heat against the average roof of its kind here: the engine gives the planes it drew (normal, area) */
    R.setPlanes = planes => { let A = 0, s = 0; planes.forEach(p => { A += p.area; s += hr(p.n) * p.area; }); R.planes = planes; R.area = A; R.heat = A > 0 && ref > 0 ? clamp(s / A / ref, 0.5, 1.6) : 1; R.roofHeat = A > 0 ? s / A : ref; if (A > 0 && ref > 0 && (b.heatK == null || Math.abs(b.heatK - R.heat) >= 0.005)) { b.heatK = R.heat; if (LENS.onHeat) { try { LENS.onHeat(b); } catch (e) { /* the card can wait */ } } } return R; };
    if (lens === 'thermal') {
      const wet = R.wx.rain.id !== 'dry', dim = wet ? 'rain' : R.wx.sky === 'marine' || R.wx.sky === 'tule' ? 'overcast' : R.wx.sky === 'smoke' ? 'haze' : ctx.weather;
      const sun = ctx.sun || { alt: 45, dir: [0.5, 0.7, 0.5] }, k = SKYK[dim] || SKYK.clear, sky = clearSky(sun.alt), month = isN(ctx.month) ? ctx.month : NOWD.getMonth(), hour = isN(ctx.hour) ? ctx.hour : 15, ta = airC(la, lo, month, hour), ds = dim === 'overcast' || dim === 'rain' ? 3 : dim === 'cloudy' ? 6 : 10;
      R.air = ta; R.month = month; R.hour = hour; R.sunAlt = sun.alt; R.tmin = 1e9; R.tmax = -1e9; R.hot = null; R.cool = null; R.dim = dim;
      let pn = null, memo = null; R.vertex = (n, zone, shade) => { if (n !== pn) { pn = n; memo = new Map(); } let F = memo.get(shade); if (F === undefined) { F = c2f(surfaceC((1 - opt.sr) * planeSun(n, sun, sky, k, shade), opt.e, ta, 1.65, ds)); memo.set(shade, F); } if (F > R.tmax) { R.tmax = F; R.hot = { n, shade }; } if (F < R.tmin) { R.tmin = F; R.cool = { n, shade }; } return [clamp((F - LENS_T[0]) / (LENS_T[1] - LENS_T[0]), 0, 1), 0, 0, 0]; };
      return R;
    }
    return R;
  }
  /* wear and time need the roof's planes first (the roof's heat), so their corner readings are made after setPlanes */
  function lensReady(R) {
    if (R.lens === 'thermal') return R;
    const b = R.b, rf = b.roof || {};
    if (R.lens === 'cover') {
      /* the covering the building most likely carries (the card's own odds), in that covering's colour, stronger the surer
         it is, with its pattern drawn at real size; tile is drawn as clay S tile or, where the era makes concrete the
         likelier, as flat concrete tile */
      const top = R.types[0], k = top[0], W = R.types.reduce((s, x) => s + x[1], 0) || 1, share = top[1] / W, C = COVER[k] || COVER.shingle, white = coverRow(k, R.lum) === 12, conc = k === 'tile' && (rf.clay != null ? rf.clay : 0.66) < 0.5;
      /* shingles are drawn in the style their likely years make more probable, as in the Shingle style view */
      const sty = k === 'shingle' ? styleOf(b, outlookOf(b, { heat: R.heat })) : null;
      R.cover = { k, share, white, conc, lam: sty ? sty.lam : null, pat: patOf(k === 'shingle' ? (sty.lam >= 0.5 ? 8 : 7) : white ? 13 : conc ? 15 : C.pat), rec: b.cover || null }; const cv = [clamp(0.2 + 0.8 * (share - 0.3) / 0.7, 0.2, 1), 1, R.cover.pat, conc ? LENS_ROW.tileC : coverRow(k, R.lum)];
      R.vertex = () => cv; return R;
    }
    if (R.lens === 'solar') {
      /* the sun each plane takes in a normal year, and the cool roof rule a re-roof here must meet */
      R.rule = coolRule(b); R.sun = { min: 1e9, max: -1e9, sum: 0, A: 0 }; R.planes.forEach(p => { const v = sunYear(p.n, R.la, R.lo); R.sun.sum += v * p.area; R.sun.A += p.area; if (v > R.sun.max) { R.sun.max = v; R.sun.best = p.n; } if (v < R.sun.min) R.sun.min = v; });
      R.meets = R.rule.req ? R.opt.sr >= R.rule.req.sr : null; let pn = null, v0 = 0;
      R.vertex = n => { if (n !== pn) { pn = n; v0 = clamp((sunYear(n, R.la, R.lo) - SUN_SC[0]) / (SUN_SC[1] - SUN_SC[0]), 0, 1); } return [v0, 0, 0, LENS_ROW.solar]; }; return R;
    }
    R.out = outlookOf(b, { heat: R.heat });
    if (R.lens === 'style') {
      /* which shingle: three tab or laminated, by the years the roof may have gone on (the share of each sold that year);
         a roof that is most likely not shingles is drawn grey, with its own pattern */
      const top = R.types[0], k = top[0], W = R.types.reduce((s, x) => s + x[1], 0) || 1, shS = (R.types.find(x => x[0] === 'shingle') || [0, 0])[1] / W, sty = styleOf(b, R.out); R.style = Object.assign({ shingle: shS, top: k }, sty);
      const lam = sty.lam >= 0.5, sure = lam ? sty.lam : 1 - sty.lam, C = COVER[k] || COVER.shingle;
      const cv = k === 'shingle' ? [clamp(0.25 + 1.5 * (sure - 0.5), 0.25, 1), 1, lam ? 8 : 7, lam ? LENS_ROW.lam : LENS_ROW.tab3] : [0.55, 1, patOf(coverRow(k, R.lum) === 12 ? 13 : C.pat), LENS_ROW.other];
      R.vertex = () => cv; return R;
    }
    if (R.lens === 'storm') {
      /* the weather on the scales, on this roof. Snow, where the storm snows at this height: its load against the ground
         snow load. Wind of 40 mph and up: the chance the roof needs a roofer, hardest at the ridge and hips and a little
         at the edges. Rain with less wind: the chance of a leak call in this storm. Dry offshore wind or smoke: ember
         exposure, at the edges, valleys and ridge where embers lodge. */
      const S0 = wxOnRoof(b, R.out, R.wx); R.st = S0;
      if (S0.kind === 'snow') { const v = S0.snowR == null ? 0.3 : clamp(S0.snowR, 0, 1); R.vertex = n => [clamp(v * (0.75 + 0.5 * n[1]), 0, 1), 0, 0, LENS_ROW.snow]; }
      else if (S0.kind === 'wind') { const a = clamp(S0.any / 0.05, 0, 1), lk = clamp(S0.leak / 0.1, 0, 1); R.vertex = (n, zone) => { const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge, v = clamp(a * (0.78 + zk), 0, 1); return lk > v ? [clamp(lk * (0.6 + 0.6 * zone.edge + 0.5 * zone.ridge), 0, 1), lk * 0.5, 6, LENS_ROW.rain] : [v, clamp(v * 1.1, 0, 1), 1, LENS_ROW.storm]; }; }
      else if (S0.kind === 'rain') { const v = clamp(S0.leak / 0.1, 0, 1); R.vertex = (n, zone) => [clamp(v * (0.6 + 0.6 * zone.edge + 0.5 * zone.ridge), 0, 1), v * 0.5, 6, LENS_ROW.rain]; }
      else if (S0.kind === 'ember') { const v = S0.ember; R.vertex = (n, zone) => [clamp(v * (0.55 + 0.5 * zone.edge + 0.3 * zone.ridge + 0.2 * zone.corner), 0, 1), clamp(v * (0.3 + zone.edge), 0, 1), 5, LENS_ROW.fire]; }
      else R.vertex = () => [0, 0, 0, LENS_ROW.storm];
      return R;
    }
    if (R.lens === 'fire') {
      /* the class of roof it most likely is (green Class A to red unrated), with ember marks where embers lodge, more of
         them the higher its zone and the nearer the record puts fire */
      const fc = fireClass(b, R.out); R.fc = fc; R.req = reroofClass(b); R.ember = emberIx(b, fc, Math.max(R.wx.windGust, 46));
      const v0 = clamp(fc.below * 1.6, 0, 1), em = R.ember;
      R.vertex = (n, zone, shade, under) => [clamp(v0 + 0.08 * zone.edge, 0, 1), clamp(em * (0.25 + 0.9 * zone.edge + 0.4 * zone.ridge + (under ? 0.4 : 0)), 0, 1), 5, LENS_ROW.fclass];
      return R;
    }
    const O = R.out, t = R.year, st = b.state || ZERO, lifeL = R.types.reduce((s, [k, w]) => s + (LIFE[RTYPE[k].life] || LIFE.shingle).L * w, 0) / R.types.reduce((s, [, w]) => s + w, 0);
    const wk = O ? O.wetK : wetK(b.z), algaeK = R.types.reduce((s, [k, w]) => s + RTYPE[k].algae * w, 0) * wk, rustK = R.types.reduce((s, [k, w]) => s + RTYPE[k].rust * w, 0), km = O ? O.km : coastKm(b.lat, b.lon), hz = O ? O.hz : hazardAt(R.zip);
    if (R.lens === 'wear') {
      /* wear to date: the share of its service life the roof has used (its likely age over the mean life of its kind: at
         1 half of such roofs have been replaced; for tile the life is the underlayment's), worked harder or easier on
         each plane by the heat it takes and by the place's heat against the state's, plus what the weather has left on
         it: the gust days it has stood through (most at the ridge and edges), wind and hail reported near it in the last
         three years and still open, fire damage on record, moss where it stays damp, rust near salt water */
      const T0 = RTYPE[R.types[0][0]] || RTYPE.shingle, yrW = (hz.wind[0] + hz.wind[1]) * T0.wind, seenW = clamp(1 - Math.pow(1 - clamp(yrW, 0, 0.5), st.age), 0, 0.6), clim = O ? O.clim : 1;
      const used = clamp(st.age / (lifeL / Math.sqrt(clim || 1)), 0, 1.2), open = clamp((b.sc.WIND || 0) + (b.sc.FIRE || 0), 0, 0.8), rust = rustAt(st.age, rustK, km);
      R.parts = { used, seenW, open, algae: algaeAt(st.age, algaeK, 1 + R.canopy * 0.8), rust, lifeL, age: st.age, clim, tile: R.types[0][0] === 'tile' }; R.wmin = 1e9; R.wmax = -1e9; R.wsum = 0; R.wn = 0;
      const scW = b.sc.WIND || 0, scF = b.sc.FIRE || 0; let pn = null, hk = 1, nf = 0.5, alO = 0, alU = 0;   /* by plane: its heat against the roof's, how far it faces north (1) or south (0), and its growth in the open and under a crown */
      R.vertex = (n, zone, shade, under) => { if (n !== pn) { pn = n; hk = clamp(R.hr(n) / (R.roofHeat || 1), 0.75, 1.35); const hzl = Math.hypot(n[0], n[2]) || 1; nf = n[1] > 0.985 ? 0.5 : clamp(0.5 - 0.5 * n[2] / hzl, 0, 1); alO = algaeAt(st.age, algaeK, 0.6 + nf); alU = algaeAt(st.age, algaeK, (0.6 + nf) * 1.7); } const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge;
        const al = under ? alU : alO, w = clamp(used * hk + seenW * (0.3 + zk) + open * 0.5 + al * 0.1 + rust * 0.4 * (0.5 + zone.edge), 0, 1);
        if (w > R.wmax) R.wmax = w; if (w < R.wmin) R.wmin = w; R.wsum += w; R.wn++;
        let md = seenW * (0.4 + 1.8 * zk) + scW * 1.2, mk = 1, x = Math.max(0, used - 0.45) * hk * 0.9; if (x > md) { md = x; mk = 3; } x = al * 0.8; if (x > md) { md = x; mk = 4; } x = Math.max(rust * (0.6 + zone.edge), scF); if (x > md) { md = x; mk = 5; }
        return [w, clamp(md, 0, 1), mk, 1]; };
    } else if (R.lens === 'time') {
      /* the years ahead: at each spot, the cause most likely to have damaged it by that year. Wind takes the ridge and hip
         caps first and a little more at the edges than in the field; heat and age work hardest on the planes that run
         hottest; rain finds the edges of things; fire and hail fall on every plane alike. */
      if (!O) return null; const A = O.all, wind = A.C.wind[t], hail = A.C.hail[t], wear = A.C.wear[t], rain = A.C.rain[t], fire = A.C.fire[t], rust = O.slow.rust[t], algae = O.slow.algae[t];
      R.now = { wind, hail, wear, rain, fire, rust, algae, any: A.any[t], rep: A.rep[t], keep: A.keep[t] }; R.rusty = rustK >= 0.5;
      let pn = null, hk = 1;
      R.vertex = (n, zone, shade, under) => { if (n !== pn) { pn = n; hk = clamp(R.hr(n) / (R.roofHeat || 1), 0.75, 1.35); } const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge;
        let v = clamp(wind * (0.8 + zk), 0, 1), mk = 1, row = LENS_ROW.wind, x = clamp(hail, 0, 1); if (x > v) { v = x; mk = 2; row = LENS_ROW.hail; } x = clamp(wear * hk, 0, 1); if (x > v) { v = x; mk = 3; row = LENS_ROW.wear_t; }
        x = clamp(rain * (0.5 + 0.7 * zone.edge + 0.5 * zone.ridge), 0, 1) * 0.8; if (x > v) { v = x; mk = 6; row = LENS_ROW.rain; } x = clamp(fire, 0, 1); if (x > v) { v = x; mk = 5; row = LENS_ROW.fire; } if (R.rusty) { x = clamp(rust * (0.6 + zone.edge), 0, 1); if (x > v) { v = x; mk = 5; row = LENS_ROW.rust; } }
        return [v, clamp(v * 1.15, 0, 1), mk, row]; };
    }
    return R;
  }
  const pc1 = v => (v < 0.005 ? 'under 1%' : v > 0.995 ? 'over 99%' : Math.round(v * 100) + '%');
  const pcS = v => (v <= 0 ? '0' : v < 0.0005 ? 'under 1 in 2,000' : v < 0.01 ? (v * 100).toFixed(1) + '%' : pc1(v));
  const ramp = (row, a, b2, ticks) => `<span class="se-ramp" style="background:linear-gradient(90deg,${LENS_PAL[row].join(',')})"></span><span class="se-ticks">${ticks.map(x => `<i>${esc(x)}</i>`).join('')}</span>`;
  const wxTitle = wx => [wx.rain.id !== 'dry' ? wx.rain.l : '', wx.wind.id !== 'calm' ? wx.wind.l : '', wx.sky !== 'clear' ? (WX_SKY.find(x => x[0] === wx.sky) || [0, ''])[1] : ''].filter(Boolean).join(' · ') || 'Dry and calm';
  const fhszText = b => (!b.fhsz ? 'its fire zone has not been read yet' : b.fhsz.cls ? `in a ${b.fhsz.l} Fire Hazard Severity Zone (${b.fhsz.ra === 'SRA' ? 'State' : 'Local'} Responsibility Area)` : 'outside the mapped Fire Hazard Severity Zones');
  const CLICK = '<span class="se-leg-cur">Click a building to read its roof.</span>';
  /* the key and the reading the engine shows beside a roof view */
  function lensLegend(lens, R, ctx) {
    ctx = ctx || {}; const b = R && R.b, addr = b ? (b.addr ? title(b.addr) : 'The building picked') : '', kinds = R ? R.types.filter(x => x[1] >= 0.03).map(([k, w]) => `${RTYPE[k].l} ${pct(w)}`).join(' · ') : '';
    if (lens === 'thermal') {
      const hm = Math.round(((((isN(ctx.hour) ? ctx.hour : 15) % 24) + 24) % 24) * 60) % 1440, wxl = R ? wxTitle(R.wx) : '', when = `${ctx.dayLabel || 'Today'}, ${String(Math.floor(hm / 60)).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')} by the sun, ${esc(wxl && wxl !== 'Dry and calm' ? wxl.toLowerCase() : ctx.weatherLabel || 'clear sky')}`, cl = R ? climOf(R.la, R.lo) : null;
      let h = `<b>Thermal: how hot each roof plane runs</b><span class="se-leg-note">${when}${R && isN(R.air) ? ` · air ${Math.round(c2f(R.air))}°F, the ${MONTHS[R.month]} normal here (NOAA's stations blended by distance and height; the nearest is ${esc(cl.near)}${cl.el != null ? ', and the ground here is taken at ' + N(Math.round(cl.el * 3.281 / 10) * 10) + ' ft' : ''})` : ''}${ctx.sunAlt != null && ctx.sunAlt <= 0 ? ' · the sun is down: roofs cool below the air under a clear sky' : ''}</span>${ramp(0, 0, 0, ['40°F', '80', '120', '160', '200°F'])}<span class="se-leg-note">From an energy balance on each plane: the sun it takes at this hour (its slope and bearing, the trees and buildings that shade it), the covering's reflectance (its kind, and how light it shows in the satellite photo) and the normal air temperature. A model, not a thermal camera.</span>`;
      if (R && R.tmax > -1e8) h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>Reflects about ${pct(R.opt.sr)} of sunlight${isN(R.lum) ? ` (it shows ${R.lum < 0.38 ? 'dark' : R.lum < 0.48 ? 'mid toned' : 'light'} in the photo)` : ''}<br>Hottest plane <b>${Math.round(R.tmax)}°F</b>${R.hot ? ' (' + faceOf(R.hot.n) + (R.hot.shade > 0.3 ? ', part shaded' : '') + ')' : ''} · coolest ${Math.round(R.tmin)}°F${R.cool ? ' (' + faceOf(R.cool.n) + (R.cool.shade > 0.5 ? ', shaded' : '') + ')' : ''}<br>Over a normal year heat ages this roof <b>${D(R.heat, 2)} times</b> as fast as the average ${esc(RTYPE[R.types[0][0]].s)} roof here${R.heat > 1.08 ? ': a darker colour, or planes turned to the sun, cost it years' : R.heat < 0.93 ? ': a lighter colour, or planes turned from the sun, save it years' : ''}, and this place ${D(climHeat(R.types[0][0], R.la, R.lo), 2)} times as fast as the average California roof of its kind (shade is not counted in the yearly rate).</span>`;
      else h += CLICK;
      return h;
    }
    if (lens === 'wear') {
      let h = `<b>Wear: what age and weather have taken so far</b><span class="se-leg-note">Today. The share of its service life each roof has used (for tile, of the underlayment's), worked harder on the planes that run hottest and in the hotter places, plus the gust days it has stood through, wind, hail and fire damage on record near it, damp and salt.</span>${ramp(1, 0, 0, ['sound', '', 'half worn', '', 'worn out'])}<span class="se-leg-marks"><span><i class="m1"></i>wind at ridge and edges</span><span><i class="m3"></i>worn patches</span><span><i class="m4"></i>moss and algae</span><span><i class="m5"></i>rust, or fire damage</span></span>`;
      if (R && R.parts) { const p = R.parts;
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>About <b>${D(p.age, 0)} year${Math.round(p.age) === 1 ? '' : 's'}</b> of a ${D(p.lifeL, 0)} year mean life used (${pct(clamp(p.used, 0, 1))})${p.tile ? ': the life is the underlayment\'s, not the tile\'s' : ''}${Math.abs(p.clim - 1) >= 0.05 ? `<br>The heat here ages a roof ${D(p.clim, 2)} times as fast as the average California roof of its kind` : ''}${p.seenW > 0.03 ? `<br>The gust days it has stood through: ${pct(p.seenW)} chance wind has taken something from it` : ''}${p.open > 0.03 ? `<br>Wind, hail or fire damage on record near it and still open: ${pct(p.open)}` : ''}${p.algae > 0.15 ? `<br>Moss or algae likely on the shaded and north planes (${pct(clamp(p.algae, 0, 1))})` : ''}${p.rust > 0.1 ? `<br>Rust likely at edges and fasteners (${pct(p.rust)}; ${D(R.out ? R.out.km : 0, 1)} km from salt water)` : ''}<br>Worn about <b>${pct(clamp(R.wn ? R.wsum / R.wn : R.wmax, 0, 1))}</b> on the whole; from ${pct(clamp(R.wmin, 0, 1))} to ${pct(clamp(R.wmax, 0, 1))} across its planes</span>`; }
      else h += CLICK;
      return h + '<span class="se-leg-note">A model of the odds from records, not an inspection: a roofer on the roof decides.</span>';
    }
    const chip = (row, l, extra) => `<span class="se-leg-row"><i style="background:${LENS_PAL[row][LENS_PAL[row].length - 1]}"></i>${esc(l)}${extra || ''}</span>`;
    if (lens === 'cover') {
      let h = `<b>Covering: what each roof is most likely made of</b><span class="se-leg-note">Each roof takes its covering's colour, stronger the surer it is, and its pattern at a common size of that covering: fly close and the courses, tiles, seams and ribs show.</span>${COVER_KEY.map(([k, l]) => chip(LENS_ROW[k], l)).join('')}`;
      if (R && R.cover) { const C = COVER[R.cover.k] || COVER.shingle, pw = photoWord(R.lum), rec = R.cover.rec, hm = b.roof.hm;
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>Most likely <b>${esc(C.l.toLowerCase())}</b> (${pct(R.cover.share)})${R.types.length > 1 ? '; else ' + esc(R.types.slice(1).filter(x => x[1] >= 0.02).map(([k, w]) => `${(COVER[k] || COVER.shingle).s} ${pct(w)}`).join(', ')) : ''}${rec && rec.k ? `<br>On record: ${esc(rec.src === 'roll' ? 'the assessor\'s roll says "' + (rec.raw || '') + '"' : rec.src === 'dins' ? 'CAL FIRE\'s inspection recorded this covering' : 'a re-roof permit names it')}.` : hm ? `<br>From what California homes built ${esc(Object.keys(hm.era).filter(e => hm.era[e] >= 0.25).map(e => ERA_L[e]).join(' or ') || 'in its era')} carry${hm.clim ? ', leaned for ' + esc(CLIM_L[hm.clim]) : ''}.` : ''}${R.cover.k === 'tile' ? `<br>Clay ${pct(b.roof.clay)} · concrete ${pct(1 - b.roof.clay)} if it is tile: drawn as ${R.cover.conc ? 'flat concrete tile' : 'S tile'}.` : C.d ? '<br>' + esc(C.d.charAt(0).toUpperCase() + C.d.slice(1)) + '.' : ''}${pw ? `<br>It shows ${pw} in the satellite photo${isLowK(R.cover.k) ? (R.cover.white ? ': drawn as a white membrane or cool coating' : ': drawn as a dark cap sheet or membrane') : ''}.` : ''}</span>`; }
      else h += CLICK;
      return h + '<span class="se-leg-note">The odds are the card\'s: the 2020 Residential Energy Consumption Survey\'s California roofs by the era a home was built, leaned by climate, and any covering a county roll, a permit or a fire inspection records. No one has looked at the roof.</span>';
    }
    if (lens === 'style') {
      let h = `<b>Shingle style: three tab or laminated</b><span class="se-leg-note">Laminated (architectural) shingles were 7% of those sold in 1984, 46% in 2000, about 70% in 2010 and 95% in 2025 (makers' filings and investor reports; Fine Homebuilding for 2010; national). Each shingle roof takes the style its likely years of roofing make more probable.</span>${chip(LENS_ROW.tab3, 'Three tab strip: 12 inch tabs, 5 inch exposure')}${chip(LENS_ROW.lam, 'Laminated: uneven tabs, 5 5/8 inch exposure')}${chip(LENS_ROW.other, 'Most likely not shingles (its own pattern)')}`;
      if (R && R.style) { const s = R.style;
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${s.top === 'shingle' ? `By its likely age the shingles went on around <b>${s.year}</b><br>Laminated <b>${pct(s.lam)}</b> · three tab <b>${pct(1 - s.lam)}</b>${s.shingle < 0.97 ? `<br>If it is shingles at all (${pct(s.shingle)})` : ''}` : `Most likely ${esc((COVER[s.top] || COVER.shingle).s)}, not shingles${s.shingle > 0.02 ? ` (shingles ${pct(s.shingle)}: if so, laminated ${pct(s.lam)})` : ''}`}</span>`; }
      else h += CLICK;
      return h + '<span class="se-leg-note">From the roof\'s likely age and national sales, not from the photo. No split for California was found.</span>';
    }
    if (lens === 'storm') {
      const wx = R ? R.wx : wxResolve(ctx);
      let h = `<b>Weather: ${esc(wxTitle(wx))}${wx.gust >= 15 ? `, gusts near ${Math.round(wx.gust)} mph` : ''}</b>`;
      if (wx.rain.id === 'dry' && wx.wind.id === 'calm' && wx.sky !== 'smoke') h += '<span class="se-leg-note">Set the rain scale, the wind scale or the sky in the Weather row to see what each would do to each roof.</span>';
      else h += `<span class="se-leg-note">${wx.gust >= 40 ? `A day with gusts near ${Math.round(wx.gust)} mph damages about <b>${pcS(gustDmg(wx.gust))}</b> of roofs enough for a roofer: the atlas's stated rates at 58 and 75 mph${wx.gust > 75 ? ', carried past 75 mph on the same line: an extrapolation' : ''}. Each roof shows its own chance, by its covering and age. ` : ''}${wx.rain.id !== 'dry' ? `Rain takes no roof by itself. It finds the leaks a roof has: each roof shows its chance of a leak call in a storm like this (${pct(wx.rain.leak)} of a year's calls at its age: a judgment). Above about ${N(Math.round(wx.snowM * 3.281 / 100) * 100)} ft this storm snows, and a roof there shows the load it adds against the ground snow load the code designs for. ` : ''}${wx.sky === 'smoke' || /^sa/.test(wx.wind.id) ? 'Dry offshore wind or smoke: each roof shows its ember exposure, an index and not a chance. ' : ''}</span>${wx.gust >= 40 ? ramp(LENS_ROW.storm, 0, 0, ['untouched', '', '2.5%', '', '5% or more']) + '<span class="se-leg-marks"><span><i class="m1"></i>cover lost at ridge, hips and edges</span></span>' : ''}${wx.rain.id !== 'dry' ? ramp(LENS_ROW.rain, 0, 0, ['0', '', '5%', '', '10% leak call']) + ramp(LENS_ROW.snow, 0, 0, ['no snow', '', 'half', '', 'the design load']) : ''}${wx.sky === 'smoke' || /^sa/.test(wx.wind.id) ? ramp(LENS_ROW.fire, 0, 0, ['low', '', 'ember exposure', '', 'high']) : ''}`;
      if (R && R.st && R.st.kind !== 'dry') { const s = R.st, T0 = RTYPE[R.types[0][0]] || RTYPE.shingle, z = b.z, gm = wxCol(z, 'gustMax'), gs = wxTxt(z, 'gustSt');
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}${s.kind === 'snow' ? `<br>Snow: this storm adds about <b>${D(s.add, 0)} lb a square foot</b>${s.pg > 0 ? `, ${pct(clamp(s.add / s.pg, 0, 9.99))} of the ${N(Math.round(s.pg))} lb ground snow load here (ASCE 7-22 as its map service gives it)` : '; the ground snow load here is not in the page\'s data'}, at about ${N(Math.round(s.el * 3.281 / 10) * 10)} ft. Loads add up storm on storm until the roof is cleared or it thaws.` : ''}${s.gust >= 40 ? `<br>Wind: needs a roofer <b>${pcS(s.any)}</b> · replaced ${pcS(s.rep)} · repaired ${pcS(s.fix)}<br>${esc(T0.does.wind)}.` : ''}${R.wx.rain.id !== 'dry' && s.kind !== 'snow' ? `<br>A leak call in this storm: <b>${pcS(s.leak)}</b>. ${esc(T0.does.rain)}.` : ''}${s.ember > 0 ? `<br>Ember exposure <b>${D(s.ember * 10, 1)} of 10</b>: ${esc(fhszText(b))}; Class A ${pct(s.fc.p[0])}.` : ''}${gm != null && s.gust >= 40 ? `<br>The strongest gust on record at ${esc(gs || 'the nearest screened station')}: ${Math.round(gm)} mph.` : ''}</span>`; }
      else if (!(wx.rain.id === 'dry' && wx.wind.id === 'calm' && wx.sky !== 'smoke')) h += CLICK;
      return h + '<span class="se-leg-note">Odds from records and stated judgments, not a forecast of a storm, and not an inspection.</span>';
    }
    if (lens === 'fire') {
      let h = `<b>Fire: the class of roof, the zone, the embers</b><span class="se-leg-note">Each roof takes the colour of the fire class it most likely carries as an assembly, by its covering and the age of the roof; the specks are where embers lodge (edges, valleys, ridge, under a crown), more of them the higher its Fire Hazard Severity Zone and the nearer CAL FIRE's record puts fire.</span>${ramp(LENS_ROW.fclass, 0, 0, ['Class A', '', 'B or C', '', 'unrated'])}<span class="se-leg-marks"><span><i class="m5"></i>where embers lodge</span></span>`;
      if (R && R.fc) { const p = R.fc.p, f = b.fire, nr = b.near, dz = b.dins, rq = R.req, T0 = RTYPE[R.types[0][0]] || RTYPE.shingle, dl = dinsLine(R.types[0][0]);
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>Class A <b>${pct(p[0])}</b> · B ${pct(p[1])} · C ${pct(p[2])} · unrated ${pct(p[3])}<br>It stands ${esc(fhszText(b))}.${rq ? ` A re-roof of half the roof or more must be at least <b>Class ${rq.c}</b>: ${esc(rq.why)}.` : ''}${f ? `<br>${f.nIn ? `Inside ${plural(f.nIn, 'fire perimeter')} since 1950 (${esc(f.in.map(x => (x.name ? title(x.name) + ' ' : '') + x.y).join(', '))})` : f.km != null ? `${D(f.km, 1)} km from the nearest fire perimeter since 1950 (${esc((f.nearest.name ? title(f.nearest.name) + ' ' : '') + f.nearest.y)})` : 'No fire perimeter since 1950 within 5 km'}${f.n5 ? `; ${plural(f.n5, 'perimeter')} within 5 km, the last in ${f.last5}` : ''}.` : ''}${dz ? `<br>CAL FIRE inspected this structure after the ${esc(dz.inc)} fire${dz.d ? ' (' + esc(monthYear(dz.d)) + ')' : ''}: <b>${esc(dinsClass(dz.dmg))}</b>${dz.roof ? ', roof ' + esc(dz.roof.toLowerCase()) : ''}${dz.eaves ? ', eaves ' + esc(dz.eaves.toLowerCase()) : ''}${dz.vent ? ', vents ' + esc(dz.vent.toLowerCase()) : ''}.` : ''}${nr && nr.n ? `<br>Within 300 m, CAL FIRE's inspections record ${N(nr.dest)} structures destroyed and ${N(nr.dmg)} damaged of ${N(nr.n)} inspected${nr.inc ? ' (' + esc(nr.inc) + ')' : ''}.` : ''}<br>Ember exposure <b>${D(R.ember * 10, 1)} of 10</b> on a day of offshore wind. ${esc(T0.does.fire)}.${dl ? `<br><span class="se-leg-note">In CAL FIRE's inspections since 2018, ${esc(dl)}: a raw share, not adjusted for the fire, the spacing or the house.</span>` : ''}</span>`; }
      else h += CLICK;
      return h + '<span class="se-leg-note">A roof\'s class is read from its likely covering and age, not from a label on it. About 90 percent of structures inside the 2025 Palisades and Eaton perimeters had Class A coverings: the roof matters, and the eaves, vents, gutters and the next house matter as much.</span>';
    }
    if (lens === 'solar') {
      let h = `<b>Solar and cool roof: the sun each plane takes in a year</b><span class="se-leg-note">Clear sky sunlight on each plane through a normal year, with the sky clear this place's share of the time; trees and neighbours are not counted. A re-roof under panels means a detach and reset (the atlas's solar line), and a re-roof of more than half the roof must meet the Energy Code's cool roof minimums in the covered climate zones.</span>${ramp(LENS_ROW.solar, 0, 0, ['600', '1,000', '1,450', '1,900', '2,300 kWh/m²'])}`;
      if (R && R.sun && R.sun.A > 0) { const s = R.sun, rl = R.rule;
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>Best plane <b>${N(Math.round(s.max / 10) * 10)} kWh a square metre a year</b>${s.best ? ' (' + faceOf(s.best) + ')' : ''} · the roof on the whole ${N(Math.round(s.sum / s.A / 10) * 10)}<br>${esc(rl.text)}${rl.req ? `<br>This roof most likely reflects about ${pct(R.opt.sr)} of sunlight (its covering, and how light it shows in the photo): ${R.meets ? 'at or over' : 'under'} the ${rl.req.sr.toFixed(2)} a re-roof must reach${R.types[0][0] === 'tile' ? '; a tile roof of 25 pounds a square foot or more is exempt, so a lift and relay of the same tile is' : ''}.` : ''}</span>`; }
      else h += CLICK;
      return h + '<span class="se-leg-note">The climate zone is the Energy Commission\'s map at the building; the code lists zones by ZIP code, so a ZIP on a boundary may differ. Exceptions (an attic at R-38, a radiant barrier, insulation above the deck) are not read here.</span>';
    }
    /* time */
    const y = R ? R.year : clamp(Math.round(+ctx.year || 0), 0, OUT_Y), key = [['wind', 'Wind (offshore wind and winter storms)'], ['rain', 'Rain and leaks'], ['fire', 'Wildfire'], ['wear', 'Heat, sun and age'], ['hail', 'Hail'], ['rust', 'Rust (metal, salt air)']];
    let h = `<b>Time: ${THIS_YEAR + y}${y ? `, ${y} year${y === 1 ? '' : 's'} from now` : ', today'}</b><span class="se-leg-note">Each roof takes the colour of the damage most likely to have reached each part of it by then, brighter as the chance grows. From the gust days, rain, atmospheric rivers, fire losses and hail on record for this ZIP, and the roof's age and kind.</span>${key.map(([c, l]) => `<span class="se-leg-row"><i style="background:${CAUSE_COL[c]}"></i>${esc(l)}${R && R.now ? ` <b>${pc1(R.now[c])}</b>` : ''}</span>`).join('')}`;
    if (R && R.now && R.out) { const O = R.out, rk = causeRank(O.all, Math.max(1, y)), topC = rk[0], T0 = RTYPE[R.types[0][0]];
      h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>By ${THIS_YEAR + y}: a roofer needed <b>${pc1(R.now.any)}</b> · the roof replaced${R.types[0][0] === 'tile' ? ' or relaid' : ''} <b>${pc1(R.now.rep)}</b>${y ? `<br>Most likely: <b>${esc(causeText(topC))}</b>. ${esc(T0.does[topC.c] || '')}.` : '<br>Move the year, or press Play.'}${R.now.algae > 0.2 ? `<br>Moss or algae on the roof then in place: ${pc1(R.now.algae)}` : ''}</span>`; }
    else h += CLICK;
    return h + '<span class="se-leg-note">Odds at the pace of the record, not a prediction of any one storm or fire, and not an inspection.</span>';
  }
  const LENS = {
    YEARS: OUT_Y, T: LENS_T, pal: LENS_PAL, rows: LENS_ROW, names: { cover: 'Covering', style: 'Shingle style', thermal: 'Thermal', wear: 'Wear', storm: 'Weather', fire: 'Fire', solar: 'Solar and cool roof', time: 'Time' },
    list: [['off', 'Off', 'The scene as it looks'],
      ['cover', 'Covering', 'What each roof is most likely made of: asphalt shingles, clay or concrete tile, wood shakes, metal, a cap sheet or membrane, a manufactured home roof or metal building panels, each in its colour with its pattern drawn at a common size of that covering'],
      ['style', 'Shingle style', 'Three tab strips or laminated (architectural) shingles: which is more likely on each shingle roof, from the years it may have gone on and the share of each sold then, with the courses drawn at their size'],
      ['thermal', 'Thermal', 'How hot each roof plane runs at the chosen day and hour: an energy balance from the sun it takes, the covering and the air. A dark roof in full July sun passes 160 degrees in the valleys and deserts'],
      ['wear', 'Wear', 'What age and weather have taken from each roof so far: the life it has used (for tile, of its underlayment), worked harder where it runs hottest, the gust days it has stood through, damage on record near it, moss and rust'],
      ['storm', 'Weather', 'What the weather now set on the rain scale, the wind scale and the sky would do to each roof: a leak call in the rain or the atmospheric river, wind damage by gust speed, snow against the ground snow load, ember exposure in dry offshore wind or smoke'],
      ['fire', 'Fire', 'The fire class each roof most likely carries (Class A, B, C or unrated) by its covering and age, the Fire Hazard Severity Zone it stands in, the fires and losses on record near it, and where embers lodge'],
      ['solar', 'Solar and cool roof', 'The sun each roof plane takes in a normal year, and the cool roof rule (Title 24, Part 6) a re-roof of that building must meet in its climate zone'],
      ['time', 'Time', 'The next 15 years: the damage most likely to reach each roof by each year (wind, rain and leaks, wildfire, heat and age, hail, rust), from this ZIP\'s gust, rain, fire and hail record and the roof\'s age and kind']],
    begin: lensBegin, ready: lensReady, legend: lensLegend, wxOnRoof, wxResolve, gustDmg, fireClass, coolRule, sunYear, styleOf, lamAt, cover: COVER, rain: WX_RAIN, wind: WX_WIND, sky: WX_SKY, now: WXNOW, engx: ENGX,
    /* the few words over a building while a roof view is on */
    label: (lens, R) => { if (!R) return ''; if (lens === 'cover') return R.cover ? (R.cover.white ? 'White membrane' : R.cover.conc ? 'Concrete tile' : (COVER[R.cover.k] || COVER.shingle).l.replace(' on a house', '').replace(' (clay or concrete)', '')) + ' ' + pct(R.cover.share) : ''; if (lens === 'style') return R.style ? (R.style.top !== 'shingle' ? 'Not shingles' : R.style.lam >= 0.5 ? 'Laminated ' + pct(R.style.lam) : 'Three tab ' + pct(1 - R.style.lam)) : ''; if (lens === 'storm') return R.st ? (R.st.kind === 'dry' ? '' : R.st.kind === 'snow' ? 'Snow +' + D(R.st.add, 0) + ' psf' : R.st.kind === 'rain' ? 'Leak ' + pcS(R.st.leak) : R.st.kind === 'ember' ? 'Embers ' + D(R.st.ember * 10, 1) : 'Wind ' + pcS(R.st.any)) : ''; if (lens === 'fire') return R.fc ? 'Class A ' + pct(R.fc.p[0]) : ''; if (lens === 'solar') return R.sun && R.sun.A > 0 ? N(Math.round(R.sun.sum / R.sun.A / 10) * 10) + ' kWh/m²' : ''; if (lens === 'thermal') return R.tmax > -1e8 ? Math.round(R.tmax) + '°F' : ''; if (lens === 'wear') return R.wn ? pct(clamp(R.wsum / R.wn, 0, 1)) + ' worn' : ''; if (!R.now) return ''; if (!R.year) return 'Today'; const t = [['Wind', R.now.wind], ['Leak', R.now.rain], ['Fire', R.now.fire], ['Age', R.now.wear], ['Hail', R.now.hail]].concat(R.rusty ? [['Rust', R.now.rust]] : []).sort((x, y) => y[1] - x[1])[0]; return t[0] + ' ' + pc1(t[1]); },
    /* sun and air for the engine: the month and the hour by the sun for a date at a longitude */
    solar: (date, lon) => { const t = new Date(date.getTime() + (lon / 15) * 3600e3); return { month: t.getUTCMonth(), hour: t.getUTCHours() + t.getUTCMinutes() / 60, doy: Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(t.getUTCFullYear(), 0, 0)) / 864e5) }; },
  };

