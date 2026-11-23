  /* ---------- the likely roof ---------- */
  const storiesRes = h => !(h > 0) ? 1 : h < 7.2 ? 1 : h < 10.8 ? 2 : 3;
  const floorsCom = h => !(h > 0) ? 1 : clamp(Math.round((h - 1) / 4), 1, 80);
  /* What California's single family roofs are made of, by the era the house was built: the 2020 Residential Energy
     Consumption Survey's California households (837 single family homes standing for 8.55 million; the occupant names
     the material, so clay and concrete tile are easily confused, and a flat roof is reported as composition or other).
     Shares of homes; slate and the unreported remainder ride with tile; "flat" is the survey's "other". The page's data
     carries the same table (META.mat) and is read first. Homes built after 2020 are taken as the 2000 to 2020 era. */
  const MAT_ERA = (META.mat && META.mat.era && META.mat.era.pre60 && META.mat.era) || {
    pre60: { shingle: 0.749, tile: 0.068, wood: 0.085, metal: 0.046, flat: 0.038 },
    y6079: { shingle: 0.754, tile: 0.174, wood: 0.031, metal: 0.015, flat: 0.018 },
    y8099: { shingle: 0.487, tile: 0.430, wood: 0.056, metal: 0.010, flat: 0.009 },
    y0020: { shingle: 0.329, tile: 0.622, wood: 0.030, metal: 0.006, flat: 0.006 },
  };
  /* clay's share of the tile, by era (the same survey: clay 18.1 percent of homes against concrete 9.3) */
  const CLAY_ERA = { pre60: 0.88, y6079: 0.66, y8099: 0.60, y0020: 0.68 };
  const ERA_OF_BIN = ['y0020', 'y0020', 'y0020', 'y8099', 'y8099', 'y6079', 'y6079', 'pre60', 'pre60', 'pre60'];
  const ERA_L = { pre60: 'before 1960', y6079: '1960 to 1979', y8099: '1980 to 1999', y0020: '2000 or later' };
  /* The climate's lean on tile, from the same survey's two climates with enough homes to report: tile is on 30.9 percent
     of single family homes in the hot dry south and Central Valley and 18.3 percent on the marine coast from Santa
     Barbara County north, against 27.4 statewide (1.13 and 0.67 times). The mountains and the far north had too few
     homes to report; the atlas takes them with the marine coast (an assumption, as module 17 states it). */
  const REGK = MODEL.REGK || { 1: 'nc', 2: 'fn', 3: 'sv', 4: 'si', 5: 'ba', 6: 'cc', 7: 'sj', 8: 'la', 9: 'oc', 10: 'ie', 11: 'sd' };
  const regKey = z => (z ? REGK[z.reg] || REGK[String(z.reg)] || '' : '');
  const CLIMK = { nc: 'marine', ba: 'marine', cc: 'marine', fn: 'mountain', si: 'mountain', sv: 'hot', sj: 'hot', la: 'hot', oc: 'hot', ie: 'hot', sd: 'hot' };
  const TILE_TILT = { hot: 1.13, marine: 0.67, mountain: 0.67 }, CLIM_L = { hot: 'the hot dry south and Central Valley', marine: 'the marine coast', mountain: 'the mountains and the far north' };
  /* San Francisco is a low slope city: of the 2,502 re-roof permits of 2023 to 2026 that name a material, 74.9 percent
     are modified bitumen, torch down or cap sheet, 4.8 single ply, 1.7 built up, 15.8 composition shingles and 1.3 tile or
     slate (the city's permit file, by keyword: 82 percent of permits name no material). Grade D. */
  const SF_MIX = { flat: 0.814, shingle: 0.158, tile: 0.013, metal: 0.01, wood: 0.005 };
  const HKEYS = ['shingle', 'tile', 'wood', 'metal', 'flat'];
  const HK_L = { shingle: 'Asphalt shingles', tile: 'Tile (clay or concrete), or slate', wood: 'Wood shakes or shingles', metal: 'Metal (standing seam or panels)', flat: 'Low slope: built up, modified bitumen or single ply', low: 'Low slope membrane', lowmf: 'Low slope membrane', mh: 'Manufactured home roof', mbldg: 'Metal building roof' };
  /* A covering on record: Riverside County's assessor (ROOF_TYPE), CAL FIRE's damage inspection of the building, or the
     words of a re-roof permit. A record is taken at 85 percent: rolls go stale after a re-roof, inspectors name what
     they see from the street, and a permit can cover one of two buildings (judgment). */
  const REC_W = 0.85;
  const riversideRoof = v => { const u = String(v || '').toUpperCase(); return /SHAKE|WOOD/.test(u) ? 'wood' : /TILE|SLATE/.test(u) ? 'tile' : /MEMBRANE|ROLL|STRUCTURAL CONCRETE/.test(u) ? 'flat' : /STEEL|COPPER|METAL/.test(u) ? 'metal' : /ROCK|COMPOSITE/.test(u) ? 'shingle' : ''; };
  const dinsRoof = v => { const u = String(v || '').toUpperCase(); return /ASPHALT/.test(u) ? 'shingle' : /TILE|CONCRETE/.test(u) ? 'tile' : /METAL/.test(u) ? 'metal' : /WOOD/.test(u) ? 'wood' : ''; };
  /* the covering a permit's own words name: Sacramento's e-permits name it outright ("21 squares of 30yr Laminated
     Dimensional Composition", "TPO Single Ply"), San Francisco's often do, and the City of Los Angeles's standard text
     ("Class A or B roof covering material weighing less than 6 pounds per sq. ft.") rules out tile without naming one */
  function permitCover(desc) {
    const u = String(desc || '').toUpperCase(); if (!u) return null;
    if (/RESET (THE )?(ROOF )?TILES?|RE-?LAY|LIFT AND (RE)?LAY|REINSTALL (EXISTING |THE )?(ROOF )?TILES?/.test(u)) return { k: 'tile', relay: true };
    if (/\bTPO\b|\bPVC\b|SINGLE.PLY|MOD(IFIED)?[ .-]*BIT|TORCH|CAP ?SHEET|BUILT.?UP|\bBUR\b|HOT MOP|ROLLED? ROOF|ELASTOMERIC|\bSPF\b|FOAM ROOF/.test(u)) return { k: 'flat' };
    if (/STANDING SEAM|METAL ROOF|STONE.COATED STEEL/.test(u)) return { k: 'metal' };
    if (/\bSHAKES?\b|WOOD SHINGLE/.test(u) && !/REMOVE (EXISTING |THE )?(WOOD )?SHAKE|OVER (EXISTING )?SHAKE|REPLACE (EXISTING )?(WOOD )?SHAKES? WITH/.test(u)) return { k: 'wood' };
    if (/\b(COMP(OSITION)?|ASPHALT|LAMINATED|DIMENSIONAL|ARCHITECTURAL|3.TAB)\b[^.;]{0,24}(SHINGLE|ROOF)|COMP(OSITION)? ?SHINGLE|\bSHINGLES?\b/.test(u) || /LAMINATED DIMENSIONAL COMPOSITION/.test(u)) return { k: 'shingle' };
    if (/(CLAY|CONCRETE|CEMENT|SPANISH|MISSION|S-?) ?TILES?|TILE ROOF|\bSLATE\b/.test(u) && !/REMOVE (EXISTING |THE )?[A-Z ]{0,12}TILE[^.;]{0,30}(INSTALL|REPLACE WITH|WITH)[^.;]{0,20}(COMP|SHINGLE)/.test(u)) return { k: 'tile' };
    if (/LESS THAN 6 (POUNDS|LBS?\.?)/.test(u)) return { not: 'tile' };
    return null;
  }
  /* the roof's size as a permit states it ("( 106 ) Squares", "21 squares of ...") */
  const permitSquares = desc => { const m = /\(?\s*(\d{1,4}(?:\.\d+)?)\s*\)?\s*SQUARES?\b/i.exec(String(desc || '')); const v = m ? +m[1] : 0; return v >= 1 && v <= 3000 ? v : 0; };
  const CHECK = {
    res: 'Shingles and their nailing, the underlayment, drip edge, flashing at walls, chimneys and vents, the deck under soft spots, and attic ventilation. Whether a re-roof needs a permit depends on the city; a re-roof of more than half the roof must meet the Energy Code\'s cool roof minimums in the covered climate zones, and in a Fire Hazard Severity Zone the roof must be a Class A assembly.',
    tile: 'Broken and slipped tiles, the underlayment at the eaves, valleys and penetrations (it ages out long before the tile: about 25 years by the trade\'s figures), flashings, bird stops at the eaves and the mortar at hips and ridge. A lift and relay puts new underlayment under the same tile; broken tile may not go back, and about three tiles in ten break in the work by one consultant\'s planning figure.',
    wood: 'Split, cupped, curled and missing shakes, moss and debris, the interlayment and the ridge. No untreated or unlisted wood roofing may be sold or applied in California; Los Angeles and San Diego allow no wood re-roof at all, and where half the roof or more is replaced the whole roof must meet today\'s class for the zone.',
    flat: 'Seams, the cap sheet\'s granules, blisters and ponding, flashings at parapets, skylights and drains, and the scuppers. A low slope re-roof of more than half the roof must meet the cool roof minimums in most climate zones (aged solar reflectance 0.63) or trade them for insulation at the deck.',
    mh: 'Seams and fasteners on a metal roof, or shingles on a pitched one; roof overs and coatings are the usual jobs. Manufactured homes are under the state housing department\'s rules, not the city\'s building code.',
    low: 'Seams, flashings at walls, curbs and drains, ponding water, blisters and wet insulation (a core cut or an infrared scan); restoration and coatings extend a sound membrane. A re-roof, recover or recoat of more than half the roof or 2,000 square feet must be a cool roof (Title 24, Part 6) and, on a replacement, brings insulation with it.',
    mbldg: 'Fasteners, seams and panel laps, rust at the eaves and around units, skylight panels and gutters; a coating or a retrofit roof over the panels is common.',
    none: 'No roof covering to replace: an open top deck.',
  };
  /* the eras a building may date from, with their odds: its year on file, or its ZIP's mix of years */
  function eraOdds(b) {
    const o = { pre60: 0, y6079: 0, y8099: 0, y0020: 0 }; const y = b.yb;
    if (y) { o[y >= 2000 ? 'y0020' : y >= 1980 ? 'y8099' : y >= 1960 ? 'y6079' : 'pre60'] = 1; return o; }
    const pr = b.prior || ybPrior(b); pr.forEach((w, i) => { o[ERA_OF_BIN[i]] += w; }); return o;
  }
  /* a house's coverings with their odds: the survey's shares for the eras it may date from, leaned by the climate (tile)
     and by where the atlas puts metal (metal_sh against its 4 percent statewide), then any covering on record */
  function houseMix(b) {
    const z = b.z || {}, era = eraOdds(b), ck = CLIMK[regKey(z)] || '', m = {}; HKEYS.forEach(k => { m[k] = 0; });
    if (b.fips === '06075') Object.assign(m, SF_MIX);
    else { Object.keys(era).forEach(e => { const w = era[e], row = MAT_ERA[e] || MAT_ERA.y6079; if (w > 0) HKEYS.forEach(k => { m[k] += w * (+row[k] || 0); }); });
      m.tile *= TILE_TILT[ck] || 1; m.metal *= clamp((isN(z.metal_sh) ? +z.metal_sh : 4) / 4, 0.5, 3); }
    let s = sum(HKEYS.map(k => m[k])) || 1; HKEYS.forEach(k => { m[k] /= s; });
    const rec = b.cover || null;   /* { k, src } or { not, src } */
    if (rec && rec.k && HKEYS.includes(rec.k)) HKEYS.forEach(k => { m[k] = (k === rec.k ? REC_W : 0) + (1 - REC_W) * m[k]; });
    else if (rec && rec.not && m[rec.not] > 0) { m[rec.not] *= 0.1; s = sum(HKEYS.map(k => m[k])) || 1; HKEYS.forEach(k => { m[k] /= s; }); }
    let clay = 0, tw = 0; Object.keys(era).forEach(e => { clay += era[e] * (MAT_ERA[e] ? +MAT_ERA[e].tile || 0 : 0) * CLAY_ERA[e]; tw += era[e] * (MAT_ERA[e] ? +MAT_ERA[e].tile || 0 : 0); });
    return { m, era, clim: ck, clay: tw > 0 ? clay / tw : 0.66, rec };
  }
  /* The roof a building most likely carries: the kinds of roof and their odds, its slope, its size in squares (100 square
     feet of roof), what a roofer would check, and the share of a building like it a roofer would expect to work on (factor). */
  function roofOf(b) {
    const c = b.cls, sq = b.sqft || 0, h = b.h || 0, noH = !(h > 0);
    /* 1.15 on a steep roof: a 4 in 12 pitch (1.054) and eaves; the City of Los Angeles's one and two family re-roof
       permits have a median of 22 squares, about what this gives for a 1,900 square foot footprint. 1.04 on a low slope one. */
    const steepSq = (pf) => Math.max(1, Math.round(sq * (pf || 1.15) / 100)), lowSq = () => Math.max(1, Math.round(sq * 1.04 / 100));
    const o = { keys: null, mix: null, mat: 'shingle', slope: 'steep', factor: 1, units: 1, name: '', short: '', size: '', check: CHECK.res, squares: 0, metalP: 0, tileP: 0, woodP: 0, clay: 0.66, hm: null };
    const hNote = noH ? ' (no height on file: FEMA carries one only where its footprints come from the 2010 to 2012 metro lidar)' : '';
    const house = (pre, size, flatLean) => {
      const hm = houseMix(b), m = Object.assign({}, hm.m);
      if (flatLean) { const t = 1 - m.flat, add = flatLean * t; HKEYS.forEach(k => { if (k !== 'flat') m[k] *= (1 - flatLean); }); m.flat += add; }
      o.hm = hm; o.keys = HKEYS.map(k => [k, m[k]]).filter(x => x[1] > 0.004).sort((x, y) => y[1] - x[1]); const s = sum(o.keys.map(x => x[1])) || 1; o.keys.forEach(x => { x[1] /= s; });
      o.metalP = m.metal; o.tileP = m.tile; o.woodP = m.wood; o.clay = hm.clay; o.mat = o.keys[0][0]; o.slope = o.mat === 'flat' ? 'low' : 'steep';
      o.mix = o.keys.map(([k, w]) => [k === 'tile' ? `Tile (${hm.clay >= 0.5 ? 'clay more likely than concrete' : 'concrete more likely than clay'}), or slate` : HK_L[k], w]);
      o.short = HK_L[o.mat].split(':')[0].split(' (')[0]; o.squares = o.slope === 'low' ? lowSq() : steepSq(); o.size = size(o.squares);
      o.check = o.mat === 'tile' ? CHECK.tile : o.mat === 'wood' ? CHECK.wood : o.mat === 'flat' ? CHECK.flat : CHECK.res;
      o.name = pre + (o.mat === 'tile' ? 'clay or concrete tile over underlayment on a wood deck (the tile outlasts the underlayment)' : o.mat === 'wood' ? 'wood shakes or shingles' : o.mat === 'metal' ? 'metal panels or standing seam over a wood deck' : o.mat === 'flat' ? 'a low slope roof: built up with a cap sheet or gravel, modified bitumen, or single ply' : 'asphalt (composition) shingles over a wood deck, hip or gable');
    };
    if (c === 'sf') { const st = storiesRes(h); house('Steep slope roof: ', n => `${st === 1 ? 'One story' : st + ' stories'}${hNote}, about ${N(n)} squares of roof`); }
    else if (c === 'garage') { house('Roof on an outbuilding: ', n => `about ${N(n)} squares; usually roofed with the house`); o.factor = 0.6; }
    else if (c === 'shed') { house('A small roof: ', n => `about ${N(n)} squares`); o.factor = 0.3; o.short = 'A small roof'; }
    else if (c === 'mh') { Object.assign(o, { keys: [['mh', 1]], mat: 'mh', short: 'Manufactured home roof', name: 'Manufactured home roof: metal on older single wides, shingles on pitched double wides; roof overs and coatings are common', size: `about ${N(steepSq(1.08))} squares`, check: CHECK.mh, squares: steepSq(1.08) }); }
    else if (c === 'mf') {
      /* floors from the height; with none on file, two floors for a footprint of 4,000 square feet or more (a judgment: the garden and courtyard blocks) */
      const pu = b.parcel && b.parcel.units > 0 ? b.parcel.units : 0, fl = noH ? (sq >= 4000 ? 2 : 1) : clamp(Math.round((h - 1.5) / 3.3), 1, 60), gross = sq * fl, units = pu || Math.max(2, Math.round(gross * 0.85 / 900)); o.units = units;
      const ft = `${fl === 1 ? 'One story' : fl + ' stories'}${noH ? ' (assumed: no height on file)' : ''}, about ${N(units)} units${pu ? ' (the assessor\'s count)' : ''}`;
      /* two to four units: a house's roof, flat more often (the dingbats and flats of Los Angeles and the Bay: a judgment, 25 percent more) */
      if (units <= 4) house('Roof over a duplex to fourplex: ', n => `${ft}, about ${N(n)} squares`, 0.25);
      else if (fl <= 3 && sq < 30000) { const hm = houseMix(b), pt = hm.m.tile / ((hm.m.tile + hm.m.shingle) || 1), P = 0.55;   /* 55 percent pitched, 45 low slope: a judgment; no count of California apartment roofs by slope was found */
        Object.assign(o, { hm, clay: hm.clay, keys: [['lowmf', 1 - P], ['shingle', P * (1 - pt)], ['tile', P * pt]].sort((x, y) => y[1] - x[1]), mat: P * (1 - pt) >= 1 - P ? 'shingle' : P * pt >= 1 - P ? 'tile' : 'low', tileP: P * pt, short: 'Apartments: pitched or low slope', name: 'Garden or courtyard apartments: pitched roofs in shingles or tile, or a low slope roof (built up, modified bitumen or single ply) behind a parapet or a mansard', size: `${ft}, about ${N(steepSq())} squares`, squares: steepSq() });
        o.mix = [['Low slope membrane or built up', 1 - P], ['Asphalt shingles on pitched roofs', P * (1 - pt)], ['Tile on pitched roofs', P * pt]].sort((x, y) => y[1] - x[1]); o.slope = o.mat === 'low' ? 'low' : 'steep'; o.check = o.mat === 'low' ? CHECK.low : o.mat === 'tile' ? CHECK.tile : CHECK.res; }
      else Object.assign(o, { keys: [['lowmf', 1]], mat: 'low', slope: 'low', short: 'Low slope membrane (mid rise)', name: 'Low slope roof over a mid rise: built up or modified bitumen with a cap sheet, or single ply (TPO or PVC); a cool roof where it has been redone under Title 24', size: `${ft}, about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
    }
    else if (c === 'parking') Object.assign(o, { keys: [], mat: 'none', slope: 'low', factor: 0.05, short: 'Open deck, no roof covering', name: 'No roof covering: an open top deck (waterproofing and joints only)', check: CHECK.none });
    else if (c === 'util') Object.assign(o, { keys: [['mbldg', 0.6], ['low', 0.4]], mat: 'mbldg', slope: 'low', factor: 0.4, short: 'Metal or a small membrane roof', name: 'Equipment shelter or station: a metal roof or a small membrane roof', size: `about ${N(lowSq())} squares`, check: CHECK.mbldg, squares: lowSq() });
    else if (c === 'ag') Object.assign(o, { keys: [['mbldg', 1]], mat: 'mbldg', slope: 'low', factor: 0.5, short: 'Metal roof (farm building)', name: 'Metal roof on a barn, packing shed or farm building', size: `about ${N(lowSq())} squares`, check: CHECK.mbldg, squares: lowSq() });
    else if (c === 'whse' || c === 'ind' || c === 'indh' || c === 'indf' || c === 'avn') Object.assign(o, { keys: [['low', 0.6], ['mbldg', 0.4]], mix: [['Low slope: built up, cap sheet or single ply over a panelized wood or metal deck', 0.6], ['Metal building roof (R panel or standing seam)', 0.4]], mat: 'low', slope: 'low', short: 'Low slope roof (warehouse)', name: c === 'avn' ? 'A hangar or terminal roof: standing seam metal or a low slope membrane' : 'A warehouse or plant roof: built up or single ply over a panelized deck on tilt up walls (the usual California warehouse), or a metal building roof', size: `about ${N(lowSq())} squares under roof`, check: CHECK.low, squares: lowSq() });
    else {
      /* shops, offices, schools, worship, health, government, arenas and the unrecorded */
      const fl = floorsCom(h), small = sq < 3200 && fl <= 2;
      if (c === 'church' && sq < 12000) Object.assign(o, { keys: [['shingle', 0.4], ['tile', 0.2], ['low', 0.3], ['metal', 0.1]], mix: [['Asphalt shingles (sanctuary)', 0.4], ['Low slope membrane (wings)', 0.3], ['Tile', 0.2], ['Metal', 0.1]], mat: 'shingle', short: 'Shingles or tile, low slope wings', name: 'A steep sanctuary roof in shingles, tile or metal, often with low slope wings for the hall and classrooms', size: `about ${N(steepSq())} squares`, squares: steepSq() });
      else if (small) Object.assign(o, { keys: [['low', 0.5], ['shingle', 0.3], ['tile', 0.12], ['metal', 0.08]], mix: [['Low slope: built up, cap sheet or single ply', 0.5], ['Asphalt shingles on a pitched roof', 0.3], ['Tile', 0.12], ['Metal', 0.08]], mat: 'low', slope: 'low', short: 'A small low slope or pitched roof', name: 'A small commercial roof: a low slope roof behind a parapet, or shingles, tile or metal on a pitched roof (often a converted house)', size: `about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
      else if (c === 'school') Object.assign(o, { keys: [['low', 0.75], ['metal', 0.15], ['shingle', 0.1]], mix: [['Low slope membrane or built up', 0.75], ['Standing seam metal', 0.15], ['Asphalt shingles', 0.1]], mat: 'low', slope: 'low', short: 'Low slope roof, metal on newer wings', name: 'Low slope roofs over the classroom wings; standing seam metal or shingles on newer buildings', size: `${fl === 1 ? 'One story' : fl + ' floors'}, about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
      else {
        const big = sq >= 60000 && fl <= 2;
        Object.assign(o, { keys: [['low', 0.9], ['mbldg', 0.1]], mix: [['Low slope: built up, modified bitumen or single ply (TPO, PVC)', 0.9], ['Metal roof', 0.1]], mat: 'low', slope: 'low', short: big ? 'Big box membrane roof' : 'Low slope membrane',
          name: c === 'hosp' ? 'Low slope membrane over a hospital: roof work is phased around rooftop equipment and air intakes' : big ? 'A big box roof: single ply or built up over a panelized or metal deck, many drains, skylights and rooftop units' : 'Low slope roof: built up or modified bitumen with a cap sheet, or single ply; white where it has been redone as a cool roof',
          size: `${fl === 1 ? 'One story' : fl + ' floors'}${noH ? ' (no height on file)' : ''}, about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
      }
    }
    /* the size a re-roof permit states, where one does */
    const ps = (b.permits || []).map(p => p.sq || 0).find(v => v > 0); if (ps && o.keys && o.keys.length) { o.squares = Math.round(ps); o.size = (o.size ? o.size.replace(/about [\d,]+ squares[^,;]*/, '').replace(/,\s*$/, '').trim() : ''); o.size = (o.size ? o.size + ', ' : '') + `${N(Math.round(ps))} squares by its re-roof permit`; }
    return o;
  }
  /* ---------- Title 24, Part 6: the cool roof a re-roof must be, by building type and climate zone ---------- */
  /* The 2022 and 2025 Energy Codes carry the same values for re-roofs (sections 150.2(b)1I for single family, 180.2(b)1A
     for multifamily, 141.0(b)2B with 140.3(a)1A for nonresidential and hotel guest rooms): the least aged solar
     reflectance, the least thermal emittance, or instead the least solar reflectance index, where more than half the
     roof is replaced (single family) or more than half or 2,000 square feet (the others). zones: the climate zones the
     rule covers. A roof weighing 25 pounds a square foot or more is exempt, which is why a tile relay is (Los Angeles's
     permits say so in words); so is a house with R-38 in the attic, a radiant barrier, or no ducts in the attic in
     zones 2, 4, 9, 10, 12 and 14. */
  const Z_ = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
  const COOL = {
    sf: { l: 'single family', trig: 'more than half the roof is replaced', steep: [[4].concat(Z_(8, 15)), 0.20, 0.75, 16], low: [[4].concat(Z_(6, 15)), 0.63, 0.75, 75] },
    mf: { l: 'multifamily', trig: 'more than half the roof or 2,000 square feet, whichever is less, is replaced, recovered or recoated', steep: [[4].concat(Z_(8, 15)), 0.20, 0.75, 16], low: [[2, 4].concat(Z_(6, 15)), 0.63, 0.75, 75] },
    nr: { l: 'nonresidential', trig: 'more than half the roof or 2,000 square feet, whichever is less, is replaced, recovered or recoated', steep: [[1, 3], 0.20, 0.75, 16], steep2: [[2].concat(Z_(4, 16)), 0.25, 0.80, 23], low: [Z_(1, 16), 0.63, 0.75, 75] },
    hotel: { l: 'hotel and motel guest rooms', trig: 'more than half the roof or 2,000 square feet, whichever is less, is replaced, recovered or recoated', steep: [Z_(2, 15), 0.20, 0.75, 16], low: [[9, 10, 11, 13, 14, 15], 0.55, 0.75, 64] },
  };
  const coolClass = b => (b.cls === 'hotel' ? 'hotel' : b.cls === 'sf' || b.cls === 'garage' || b.cls === 'shed' || (b.cls === 'mf' && ((b.roof && b.roof.units) || 0) <= 2) ? 'sf' : b.cls === 'mf' || b.cls === 'dorm' || b.cls === 'care' ? 'mf' : b.cls === 'mh' ? '' : 'nr');
  const czOf = b => { const v = b && (b.cz || (b.z && (b.z.cz || b.z.cz16))); const n = parseInt(v, 10); return n >= 1 && n <= 16 ? n : null; };
  function coolRule(b, slope) {
    const cc = coolClass(b), C = COOL[cc], cz = czOf(b); if (!C) return { cls: cc, cz, none: true, text: 'A manufactured home\'s roof is under the state housing department\'s rules, not the Energy Code\'s re-roof sections.' };
    slope = slope || ((b.roof && b.roof.slope) === 'low' ? 'low' : 'steep');
    const pick = cz == null ? null : slope === 'low' ? (C.low[0].includes(cz) ? C.low : null) : C.steep[0].includes(cz) ? C.steep : C.steep2 && C.steep2[0].includes(cz) ? C.steep2 : null;
    const o = { cls: cc, l: C.l, cz, slope, trig: C.trig, req: pick ? { sr: pick[1], e: pick[2], sri: pick[3] } : null };
    o.text = cz == null ? 'The climate zone is not known for this building yet, so the cool roof rule cannot be read.' : pick ? `Climate zone ${cz}: when ${C.trig}, a ${slope === 'low' ? 'low slope' : 'steep'} ${C.l} roof must have an aged solar reflectance of at least ${pick[1].toFixed(2)} and a thermal emittance of at least ${pick[2].toFixed(2)}, or a solar reflectance index of at least ${pick[3]}.` : `Climate zone ${cz}: the Energy Code sets no cool roof minimum for a ${slope === 'low' ? 'low slope' : 'steep'} ${C.l} re-roof here.`;
    return o;
  }

