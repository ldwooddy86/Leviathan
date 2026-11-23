  /* ---------- the store of buildings and tiles ---------- */
  const B = new Map(), T = new Map();
  const ZIP_RE = /^9[0-6]\d{3}$/;
  function ingest(fc, t) {
    const out = [];
    (fc.features || []).forEach(f => {
      const p = f.properties || {}, g = f.geometry; if (!g) return;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null; if (!polys) return;
      const id = String(p.UUID || (p.BUILD_ID != null ? 'b' + p.BUILD_ID : '') || '').replace(/[{}]/g, '').toLowerCase() || ('p' + (+p.LATITUDE).toFixed(6) + (+p.LONGITUDE).toFixed(6));
      let b = B.get(id);
      if (!b) {
        const rings = []; polys.forEach(poly => poly.forEach(r => rings.push(r.map(([lo, la]) => [la, lo]))));
        const bb = bboxOf(rings); let la = +p.LATITUDE, lo = +p.LONGITUDE; if (!isN(la) || !isN(lo) || !inBox(la, lo, [bb[0] - 0.001, bb[1] - 0.001, bb[2] + 0.001, bb[3] + 0.001])) { la = (bb[0] + bb[2]) / 2; lo = (bb[1] + bb[3]) / 2; }
        /* FEMA's California footprints carry no address (none in 25 places sampled) and a height only where they come from
           the 2010 to 2012 metro lidar (SOURCE NGA): the address comes from the parcel roll, a permit, CAL FIRE's
           inspection or the geocoder, and a missing height is said, not guessed */
        const a = addrParts(p.PROP_ADDR), zf = p.PROP_ZIP ? String(p.PROP_ZIP).slice(0, 5) : '';
        b = { id, bid: p.BUILD_ID, rings, bb, lat: la, lon: lo, occ: p.OCC_CLS || '', prim: p.PRIM_OCC || '', cls: classify(p), sqft: +p.SQFEET || 0, h: +p.HEIGHT || 0,
          addr: p.PROP_ADDR ? String(p.PROP_ADDR) : '', addrSrc: p.PROP_ADDR ? 'fema' : '', akey: a.key, street: a.street, city: String(p.PROP_CITY || '').toUpperCase(), zipF: ZIP_RE.test(zf) ? zf : '',
          fsrc: String(p.SOURCE || ''), img: p.IMAGE_DATE ? String(p.IMAGE_DATE).slice(0, 10) : '',
          yb: null, ybSrc: '', parcel: null, permits: [], tiles: new Set(), lay: null, dins: null, fhsz: null, fire: null, cz: null };
        b.zip = (b.zipF && ZI[b.zipF] && ZPI[b.zipF] && inBox(la, lo, ZPI[b.zipF].bb) ? b.zipF : '') || zipAt(la, lo) || b.zipF;
        b.z = ZI[b.zip] || null; b.fips = b.z ? b.z.fips : null;
        B.set(id, b);
      }
      b.tiles.add(t.k); t.ids.add(id); out.push(b);
    });
    return out;
  }
  const quarters = box => { const mx = (box.w + box.e) / 2, my = (box.s + box.n) / 2; return [{ w: box.w, e: mx, s: box.s, n: my }, { w: mx, e: box.e, s: box.s, n: my }, { w: box.w, e: mx, s: my, n: box.n }, { w: mx, e: box.e, s: my, n: box.n }]; };
  const padBox = (box, m) => { const dla = m / 110900, dlo = m / (111320 * Math.cos(rad((box.s + box.n) / 2))); return { w: box.w - dlo, e: box.e + dlo, s: box.s - dla, n: box.n + dla }; };
  async function fetchBuildings(box, depth) {
    const u = EP.bldg + '?' + qs({ where: '1=1', geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'BUILD_ID,OCC_CLS,PRIM_OCC,PROP_ADDR,PROP_CITY,PROP_ZIP,HEIGHT,SQFEET,LATITUDE,LONGITUDE,UUID,SOURCE,IMAGE_DATE', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'geojson' });
    const j = await getJSON(u, { timeout: 40000 });
    /* the service sends at most 2,000 buildings a request: a fuller box is asked again as four quarters */
    if (j.properties && j.properties.exceededTransferLimit && (depth || 0) < 2) {
      const parts = await Promise.all(quarters(box).map(x => fetchBuildings(x, (depth || 0) + 1)));
      return { features: parts.flatMap(p => p.features || []) };
    }
    return j;
  }
  /* one envelope query of an ArcGIS layer, quartered when the answer is cut off; rings come back as [lat, lon] */
  async function arcBox(url, box, fields, extra, depth) {
    const j = await getJSON(url + '?' + qs(Object.assign({ where: '1=1', geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: fields, returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'json' }, extra || {})), { timeout: 40000 });
    if (j.exceededTransferLimit && (depth || 0) < 2) return (await Promise.all(quarters(box).map(x => arcBox(url, x, fields, extra, (depth || 0) + 1)))).flat();
    return (j.features || []).map(f => { const g = f.geometry || {}, rings = (g.rings || []).map(rg => rg.map(([lo, la]) => [la, lo])); return { a: f.attributes || {}, rings, bb: rings.length ? bboxOf(rings) : null, pt: isN(g.y) && isN(g.x) ? [g.y, g.x] : null }; });
  }
  const txt = v => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  /* the parcel roll of the tile's county: every parcel in the tile with its shape, joined to the buildings whose centre falls inside it */
  async function fetchParcels(box, fips) {
    const P = PARCEL[fips]; if (!P) return [];
    let fs = await arcBox(P.url, box, P.f, P.q);
    if (P.url2) fs = fs.concat(await arcBox(P.url2, box, P.f, P.q).catch(() => []));   /* Ventura keeps the homes built before 1955 in a second layer */
    const seen = new Set(), out = [];
    fs.forEach(x => { const o = P.m(x.a); o.situs = txt(o.situs); o.city = txt(o.city); o.use = txt(o.use); o.apn = txt(o.apn); o.roll = txt(o.roll) || P.roll || ''; o.rings = x.rings; o.bb = x.bb; o.county = P.n; o.noYb = !!P.noYb;
      const k = o.apn + '|' + (o.bb ? o.bb.map(v => v.toFixed(5)).join(',') : ''); if (seen.has(k)) return; seen.add(k); out.push(o); });
    /* Riverside: the year built and the roof covering sit in a table of buildings, asked by parcel number; the largest building speaks for the parcel */
    if (P.table) { const pins = [...new Set(out.map(o => o.apn).filter(v => /^[0-9A-Z-]+$/i.test(v)))];
      for (let i = 0; i < pins.length; i += 150) { const part = pins.slice(i, i + 150);
        const j = await getJSON(P.table, { timeout: 40000, post: { where: `PIN IN (${part.map(v => `'${v}'`).join(',')})`, outFields: 'PIN,YEAR_BUILT,NUMBER_OF_STORIES,ROOF_TYPE,LIVING_AREA', returnGeometry: 'false', f: 'json' } });
        const by = new Map(); (j.features || []).forEach(f => { const a = f.attributes || {}, cur = by.get(String(a.PIN)); if (!cur || (+a.LIVING_AREA || 0) > (+cur.LIVING_AREA || 0)) by.set(String(a.PIN), a); });
        out.forEach(o => { const a = by.get(o.apn); if (!a) return; const y = yr4(a.YEAR_BUILT); o.yb = y && y > 1800 ? y : null; o.roof = txt(a.ROOF_TYPE); o.roofK = riversideRoof(a.ROOF_TYPE); o.stories = +a.NUMBER_OF_STORIES || 0; }); } }
    return out;
  }
  /* San Francisco's assessor roll: one point a parcel (a condominium building has one a unit), newest closed roll */
  const SF_ROLL = 2025;
  function sfSitus(s) { const m = /^\s*\d{4}\s+(\d{4})[A-Z]?\s+(.+?)\s*([A-Z]{2})?\d{0,4}\s*$/.exec(String(s || '').toUpperCase()); if (!m || !+m[1]) return ''; const ty = { ST: 'ST', AV: 'AVE', BL: 'BLVD', DR: 'DR', CT: 'CT', WY: 'WAY', PL: 'PL', TR: 'TER', RD: 'RD', LN: 'LN', HY: 'HWY', CR: 'CIR', AL: 'ALY', PK: 'PARK', PZ: 'PLZ' }[m[3] || ''] || ''; return (+m[1]) + ' ' + m[2].replace(/\s+/g, ' ').trim() + (ty ? ' ' + ty : ''); }
  async function fetchSfRoll(box) {
    const j = await getJSON(EP.sfroll + '?' + qs({ $select: 'property_location,parcel_number,use_definition,property_class_code_definition,year_property_built,number_of_stories,number_of_units,the_geom', $where: `within_box(the_geom, ${box.n.toFixed(6)}, ${box.w.toFixed(6)}, ${box.s.toFixed(6)}, ${box.e.toFixed(6)}) AND closed_roll_year=${SF_ROLL}`, $limit: 5000 }), { timeout: 40000 });
    return (Array.isArray(j) ? j : []).map(r => { const g = r.the_geom || {}, c = g.coordinates || (isN(+g.longitude) ? [+g.longitude, +g.latitude] : null); if (!c) return null; return { pt: [+c[1], +c[0]], rings: [], bb: null, yb: yr4(r.year_property_built), situs: sfSitus(r.property_location), city: 'San Francisco', use: txt(r.property_class_code_definition || r.use_definition), apn: txt(r.parcel_number), roll: String(SF_ROLL), units: +r.number_of_units || 0, stories: +r.number_of_stories || 0, county: 'San Francisco' }; }).filter(Boolean);
  }
  /* San Diego's roll gives the effective year as two digits: a year past this one's two digits is the 1900s; so is one on a
     footprint FEMA drew from the 2010 to 2012 lidar when it is past 12; otherwise the ZIP's housing ages decide, and the card says so */
  function sdYear(yy, b) { const n = parseInt(yy, 10); if (!(n >= 0)) return null; const cur = THIS_YEAR % 100; if (n > cur) return { y: 1900 + n, how: 'sure' }; if (b.fsrc === 'NGA' && n > 12) return { y: 1900 + n, how: 'lidar' }; const pr = ybPrior(b); return pr[binOf(2000 + n)] >= pr[binOf(1900 + n)] ? { y: 2000 + n, how: 'guess' } : { y: 1900 + n, how: 'guess' }; }
  function joinParcels(t, parcels) {
    const polys = parcels.filter(q => q.bb), pts = parcels.filter(q => q.pt && !q.bb), groups = new Map();
    const take = (b, p) => {
      if (b.parcel && !(b.parcel.noYb && !p.noYb)) return;
      b.parcel = { yb: p.yb || null, eff: p.eff || null, situs: p.situs, city: p.city, use: p.use, roll: p.roll, county: p.county, apn: p.apn, units: p.units || 0, roof: p.roof || '', roofK: p.roofK || '', stories: p.stories || 0, noYb: !!p.noYb, yy: p.yy || '', n: p.n || 1 };
      let yb = p.yb, how = '';
      if (!yb && p.yy) { const s = sdYear(p.yy, b); if (s) { yb = s.y; how = s.how; b.parcel.yb = yb; b.parcel.yyHow = how; } }
      if (yb && yb <= THIS_YEAR && (!b.yb || b.ybSrc === 'dins') && b.cls !== 'garage' && b.cls !== 'shed') { b.yb = yb; b.ybSrc = 'parcel'; }
      if (!b.h && p.stories > 0) { b.h = 3.2 * p.stories + 1.5; b.hSrc = 'stories'; }
      if ((!b.addr || b.addrSrc === 'geocoder') && p.situs && /^\d/.test(p.situs)) { b.addr = p.situs; b.addrSrc = 'parcel'; if (p.city && !b.city) b.city = String(p.city).toUpperCase(); const a = addrParts(p.situs, p.city); b.akey = a.key; b.street = a.street; }
    };
    t.ids.forEach(id => { const b = B.get(id); if (!b) return; const pi = polys.findIndex(q => inBox(b.lat, b.lon, q.bb) && inRings(b.lat, b.lon, q.rings)); if (pi < 0) return; take(b, polys[pi]); const g = groups.get(pi) || []; g.push(b); groups.set(pi, g); });
    /* a roll of points: each point goes to the building it falls in, else the main building nearest it within 12 m; a
       building with several (condominiums) takes the earliest year and the count as its units */
    if (pts.length) { const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), by = new Map();
      pts.forEach(p => { let best = null, bd = 1e9; bs.forEach(b => { if (b.cls === 'shed') return; const d = edgeMeters(p.pt[0], p.pt[1], b) + (b.cls === 'garage' ? 6 : 0); if (d < bd) { bd = d; best = b; } }); if (best && bd <= 12) { const g = by.get(best) || []; g.push(p); by.set(best, g); } });
      by.forEach((g, b) => { const ys = g.map(p => p.yb).filter(Boolean), first = g.find(p => p.situs) || g[0]; take(b, Object.assign({}, first, { yb: ys.length ? Math.min(...ys) : null, units: Math.max(g.length, ...g.map(p => p.units || 0)), n: g.length })); }); }
    /* FEMA gives a detached garage or a back house the main house's class: on one parcel, a small second structure
       (under 900 sq ft and under 60% of the largest) is read as the accessory building it most likely is */
    groups.forEach(g => { const hs = g.filter(b => b.cls === 'sf' || b.cls === 'garage'); if (hs.length < 2) return; const main = hs.reduce((m, b) => (b.sqft > m.sqft ? b : m), hs[0]); hs.forEach(b => { if (b !== main && b.cls === 'sf' && b.sqft < 900 && b.sqft < 0.6 * main.sqft) { b.cls = 'garage'; b.acc = true; if (b.ybSrc === 'parcel') { b.yb = null; b.ybSrc = ''; } } }); });
  }

  /* ---------- CAL FIRE at the site: the zone, the fires round it, the inspection of the building ---------- */
  /* Zones, perimeters and the climate zone are asked once for a square of about 5 km (a zoom 13 map tile) and kept;
     the damage inspections are asked for each map square of buildings, 250 m wider than it. */
  const FCELL_Z = 13, FC = new Map();
  const FH_L = { 1: 'Moderate', 2: 'High', 3: 'Very High' };
  function fireCell(la, lo) {
    const x = lon2x(lo, FCELL_Z), y = lat2y(la, FCELL_Z), k = x + '/' + y; let c = FC.get(k); if (c && (c.p || c.ok || Date.now() - c.at < 120000)) return c.p || Promise.resolve(c);
    c = { k, box: tileBox(FCELL_Z, x, y), zones: [], perims: [], cz: null, czs: [], errs: [], ok: false, at: Date.now() }; FC.set(k, c);
    const zq = (path, ra) => arcBox(EP.fire + path, c.box, 'FHSZ,FHSZ_Description', { maxAllowableOffset: 0.0003, geometryPrecision: 5 }).then(fs => fs.forEach(f => { const cls = +f.a.FHSZ; if (f.bb && cls >= 1 && cls <= 3) c.zones.push({ cls, l: FH_L[cls], ra, rings: f.rings, bb: f.bb }); })).catch(e => c.errs.push('Fire Hazard Severity Zones: ' + why(e)));
    const pq = arcBox(EP.fire + EP.perim, padBox(c.box, 5000), 'YEAR_,FIRE_NAME,GIS_ACRES', { maxAllowableOffset: 0.0008, geometryPrecision: 4 }).then(fs => fs.forEach(f => { const y2 = +f.a.YEAR_; if (f.bb && y2 >= 1950) c.perims.push({ y: y2, name: txt(f.a.FIRE_NAME), ac: +f.a.GIS_ACRES || 0, rings: f.rings, bb: f.bb }); })).catch(e => c.errs.push('Fire perimeters: ' + why(e)));
    const cq = getJSON(EP.cz + '?' + qs({ where: '1=1', geometry: env(c.box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'BZone', returnGeometry: 'false', f: 'json' }), { timeout: 25000 }).then(j => { c.czs = [...new Set((j.features || []).map(f => parseInt((f.attributes || {}).BZone, 10)).filter(n => n >= 1 && n <= 16))]; c.cz = c.czs.length === 1 ? c.czs[0] : null; }).catch(e => c.errs.push('Climate zone: ' + why(e)));
    c.p = Promise.all([zq(EP.fhszS, 'SRA'), zq(EP.fhszL, 'LRA'), pq, cq]).then(() => { c.p = null; c.ok = c.errs.length < 4; c.at = Date.now(); if (FC.size > 60) { const k0 = FC.keys().next().value; if (k0 !== k) FC.delete(k0); } return c; });
    return c.p;
  }
  /* a square that straddles two climate zones asks for the zone at its own centre */
  async function czAt(la, lo) { const j = await getJSON(EP.cz + '?' + qs({ where: '1=1', geometry: lo.toFixed(5) + ',' + la.toFixed(5), geometryType: 'esriGeometryPoint', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'BZone', returnGeometry: 'false', f: 'json' }), { timeout: 20000 }); const n = parseInt((((j.features || [])[0] || {}).attributes || {}).BZone, 10); return n >= 1 && n <= 16 ? n : null; }
  function applyCell(b, c, tcz) {
    if (!b || !c) return;
    let top = null; c.zones.forEach(zn => { if ((!top || zn.cls > top.cls) && inBox(b.lat, b.lon, zn.bb) && inRings(b.lat, b.lon, zn.rings)) top = zn; });
    if (!c.errs.some(e => /^Fire Hazard/.test(e))) b.fhsz = top ? { cls: top.cls, l: top.l, ra: top.ra } : { cls: 0, l: '', ra: '' };
    if (!c.errs.some(e => /^Fire perimeters/.test(e))) { const ins = [], near = []; let km = 99, nearest = null;
      c.perims.forEach(p => { const pad = 0.05; if (!inBox(b.lat, b.lon, [p.bb[0] - pad, p.bb[1] - pad, p.bb[2] + pad, p.bb[3] + pad])) return; const d = edgeMeters(b.lat, b.lon, p) / 1000; if (d === 0) ins.push(p); if (d <= 5) near.push(p); if (d < km) { km = d; nearest = p; } });
      const pick = p => ({ y: p.y, name: p.name, ac: p.ac });
      b.fire = { in: ins.sort((x, y) => y.y - x.y).slice(0, 4).map(pick), nIn: ins.length, n5: near.length, last5: near.length ? Math.max(...near.map(p => p.y)) : null, big5: near.length ? pick(near.reduce((m, p) => (p.ac > m.ac ? p : m), near[0])) : null, km: nearest && km <= 5 ? km : null, nearest: nearest && km <= 5 ? pick(nearest) : null }; }
    const cz = c.cz || tcz || null; if (cz) b.cz = cz;
  }
  async function fetchDins(t) {
    const fs = await arcBox(EP.fire + EP.dins, padBox(t.box, 250), 'DAMAGE,STRUCTURETYPE,INCIDENTNAME,INCIDENTSTARTDATE,ROOFCONSTRUCTION,EAVES,VENTSCREEN,YEARBUILT,SITEADDRESS');
    return fs.filter(f => f.pt).map(f => { const a = f.a, ms = +a.INCIDENTSTARTDATE, d = ms > 0 ? ymd(ms) : ''; return { lat: f.pt[0], lon: f.pt[1], dmg: txt(a.DAMAGE), type: txt(a.STRUCTURETYPE), inc: title(txt(a.INCIDENTNAME)), d, y: d ? fracYear(d) : null, roof: txt(a.ROOFCONSTRUCTION), eaves: txt(a.EAVES), vent: txt(a.VENTSCREEN), yb: yr4(a.YEARBUILT), addr: txt(a.SITEADDRESS) }; });
  }
  /* an inspection joins the building its point falls in, else the nearest within 15 m (a main building before a shed);
     the newest inspection speaks for the building. Each building also counts the inspections within 300 m of it. */
  function joinDins(t, pts) {
    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean); t.dinsN = pts.length;
    pts.forEach(p => { let best = null, bd = 1e9; bs.forEach(b => { if (Math.abs(b.lat - p.lat) > 0.0008 || Math.abs(b.lon - p.lon) > 0.001) return; const d = edgeMeters(p.lat, p.lon, b) + (b.cls === 'shed' ? 8 : b.cls === 'garage' ? 4 : 0); if (d < bd) { bd = d; best = b; } });
      if (!best || bd > 15) return; if (best.dins && best.dins.y >= (p.y || 0)) return; best.dins = p;
      if (p.yb && !best.yb && best.cls !== 'garage' && best.cls !== 'shed' && !/Utility|Misc/i.test(p.type)) { best.yb = p.yb; best.ybSrc = 'dins'; }
      if (!best.addr && /^\d/.test(p.addr)) { best.addr = p.addr.split(',')[0]; best.addrSrc = 'dins'; const a = addrParts(p.addr); best.akey = a.key; best.street = a.street; if (!best.city) best.city = (p.addr.split(',')[1] || '').trim().toUpperCase(); } });
    if (pts.length) bs.forEach(b => { let n = 0, dest = 0, dm = 0; const inc = new Map(); pts.forEach(p => { if (Math.abs(b.lat - p.lat) > 0.0029 || Math.abs(b.lon - p.lon) > 0.0036 || meters([b.lat, b.lon], [p.lat, p.lon]) > 300) return; n++; if (/^Destroyed/i.test(p.dmg)) { dest++; inc.set(p.inc, (inc.get(p.inc) || 0) + 1); } else if (dinsW(p.dmg) > 0) dm++; });
      const top = [...inc].sort((x, y) => y[1] - x[1])[0]; b.near = { n, dest, dmg: dm, inc: top ? top[0] : '' }; });
  }

  /* ---------- re-roof permits, where a city publishes them ---------- */
  /* The City of Los Angeles (Department of Building and Safety, three tables: 1996 to 2009, 2010 to 2019, 2020 on), by
     map point; Los Angeles County's EPIC-LA (unincorporated areas and contract cities, 2018 on), by map point and
     assessor's parcel number; San Francisco (Department of Building Inspection, with its re-roof flag), by map point;
     the City of Sacramento (2016 on) and San Jose (active, expired and under inspection permits only), which carry no
     map point and are asked by the parcel numbers of the tile. A re-roof is known by its words everywhere but in San
     Francisco (the flag) and San Jose (the work type); rooftop solar is not roof work (EPIC-LA's work class "Roof Mount"
     is solar, and is never matched). */
  const ROOFQ = f => `(upper(${f}) like '%REROOF%' OR upper(${f}) like '%RE-ROOF%' OR upper(${f}) like '%RE ROOF%' OR upper(${f}) like '%TEAR OFF%' OR upper(${f}) like '%TEAR-OFF%' OR upper(${f}) like '%ROOFING%' OR upper(${f}) like '%ROOF TILE%' OR upper(${f}) like '%ROOF REPAIR%' OR upper(${f}) like '%ROOF COVERING%')`;
  const BAD_STATUS = /VOID|CANCEL|WITHDR|DENIED|DISAPPROV|REVOKED|REJECT|NOT REQUIRED|ERROR|REFUSED/i;
  const isoDay = v => { const s = String(v || ''); let m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s); if (m) return m[0]; m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : ''; };
  const digits = v => String(v == null ? '' : v).replace(/\D/g, '');
  const reroofHead = d => /^\s*(RE[- ]?ROOF|TEAR[- ]?OFF|REMOVE (THE )?(EXISTING )?ROOF)/i.test(d);
  async function fetchPermits(t) {
    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), files = new Set(bs.map(b => PFILE[b.fips]).filter(Boolean)), out = [], errs = []; let asked = 0;
    const bx = t.box, wb = `${bx.n.toFixed(6)}, ${bx.w.toFixed(6)}, ${bx.s.toFixed(6)}, ${bx.e.toFixed(6)}`;
    const push = p => { if (!/^\d{4}-\d\d-\d\d$/.test(p.d)) return; p.y = fracYear(p.d); p.desc = txt(p.desc); p.key = addrParts(p.addr).key; p.cov = permitCover(p.desc); p.sq = permitSquares(p.desc); out.push(p); };
    const jobs = [];
    if (files.has('la')) {
      EP.ladbs.forEach(([url, from]) => { asked++; jobs.push(getJSON(url + '?' + qs({ $select: 'primary_address,permit_type,permit_sub_type,issue_date,status_desc,valuation,work_desc,lat,lon,apn', $where: `within_box(geolocation, ${wb}) AND (permit_type='Bldg-New' OR ${ROOFQ('work_desc')})`, $limit: 5000 }), { timeout: 30000 })
        .then(j => (Array.isArray(j) ? j : []).forEach(r => { const la = +r.lat, lo = +r.lon; if (!isN(la) || !isN(lo) || !la || BAD_STATUS.test(r.status_desc || '')) return; const ty = txt(r.permit_type), d = txt(r.work_desc);
          push({ lat: la, lon: lo, addr: txt(r.primary_address), d: isoDay(r.issue_date), desc: d, type: [ty, txt(r.permit_sub_type)].filter(Boolean).join(', '), kind: /New/i.test(ty) ? 'newc' : reroofHead(d) ? 'reroof' : 'roofwork', val: +r.valuation || 0, apn: digits(r.apn), src: 'City of Los Angeles' }); }))
        .catch(e => errs.push(`Los Angeles permits (${from} on): ` + why(e)))); });
      asked++; jobs.push(arcBox(EP.epicla, bx, 'CASENUMBER,WORKCLASS_NAME,CASENAME,STATUS,DESCRIPTION,MAIN_ADDRESS,MAIN_AIN,ISSUANCE_DATE,APPLY_DATE,PERMIT_VALUATION', { where: `MODULENAME='PermitManagement' AND (UPPER(DESCRIPTION) LIKE '%REROOF%' OR UPPER(DESCRIPTION) LIKE '%RE-ROOF%' OR UPPER(DESCRIPTION) LIKE '%RE ROOF%' OR UPPER(DESCRIPTION) LIKE '%TEAR OFF%' OR UPPER(DESCRIPTION) LIKE '%TEAR-OFF%')` })
        .then(fs => fs.forEach(f => { const a = f.a; if (!f.pt || BAD_STATUS.test(a.STATUS || '') || /Roof Mount|Solar/i.test(a.WORKCLASS_NAME || '')) return; const ms = +a.ISSUANCE_DATE || +a.APPLY_DATE, d = txt(a.DESCRIPTION);
          push({ lat: f.pt[0], lon: f.pt[1], addr: txt(a.MAIN_ADDRESS), d: ms > 0 ? ymd(ms) : '', desc: d, type: [txt(a.WORKCLASS_NAME), txt(a.CASENAME)].filter(Boolean).join(', '), kind: reroofHead(d) || /Repair\/Replacement/i.test(a.WORKCLASS_NAME || '') ? 'reroof' : 'roofwork', val: +a.PERMIT_VALUATION || 0, apn: digits(a.MAIN_AIN), src: 'Los Angeles County (EPIC-LA)' }); }))
        .catch(e => errs.push('Los Angeles County permits: ' + why(e))));
    }
    if (files.has('sf')) {
      asked++; jobs.push(getJSON(EP.sfp + '?' + qs({ $select: 'permit_type_definition,street_number,street_name,street_suffix,description,status,issued_date,filed_date,estimated_cost,revised_cost,existing_use,reroof,location', $where: `within_box(location, ${wb}) AND (reroof='Y' OR ${ROOFQ('description')} OR permit_type_definition like 'new construction%')`, $limit: 5000 }), { timeout: 30000 })
        .then(j => (Array.isArray(j) ? j : []).forEach(r => { const g = r.location || {}, c = g.coordinates || (isN(+g.longitude) ? [+g.longitude, +g.latitude] : null); if (!c || BAD_STATUS.test(r.status || '')) return; const ty = txt(r.permit_type_definition), d = txt(r.description), iss = isoDay(r.issued_date); if (!iss) return;
          push({ lat: +c[1], lon: +c[0], addr: [r.street_number, r.street_name, r.street_suffix].filter(x => x != null && String(x).trim()).join(' '), d: iss, desc: d, type: [ty, txt(r.existing_use)].filter(Boolean).join(', '), kind: /^new construction/i.test(ty) ? 'newc' : r.reroof === 'Y' || reroofHead(d) ? 'reroof' : 'roofwork', val: +r.revised_cost || +r.estimated_cost || 0, src: 'San Francisco' }); }))
        .catch(e => errs.push('San Francisco permits: ' + why(e))));
    }
    /* by parcel number: the buildings' parcels must be joined first (the caller waits for them) */
    const apns = fips => [...new Set(bs.filter(b => b.fips === fips && b.parcel && b.parcel.apn).map(b => digits(b.parcel.apn)).filter(v => v.length >= 6))];
    const where = b2 => { const o = bs.find(b => b.parcel && digits(b.parcel.apn) === b2); return o ? [o.lat, o.lon] : [(bx.s + bx.n) / 2, (bx.w + bx.e) / 2]; };
    if (files.has('sac')) { const list = apns('06067');
      for (let i = 0; i < list.length; i += 120) { const part = list.slice(i, i + 120); EP.sacp.forEach(url => { asked++; jobs.push(getJSON(url, { timeout: 30000, post: { where: `Parcel_No IN (${part.map(v => `'${v}'`).join(',')}) AND (UPPER(Work_Desc) LIKE '%TEAR OFF%' OR UPPER(Work_Desc) LIKE '%REROOF%' OR UPPER(Work_Desc) LIKE '%RE-ROOF%' OR UPPER(Work_Desc) LIKE '%RE ROOF%' OR UPPER(Activity_Code) LIKE '%ROOF%')`, outFields: 'Type,Sub_Type,Status_Date,Current_Status,Parcel_No,Address,Valuation,Activity_Code,Work_Desc', returnGeometry: 'false', f: 'json' } })
          .then(j => (j.features || []).forEach(f => { const a = f.attributes || {}; if (BAD_STATUS.test(a.Current_Status || '')) return; const ap = digits(a.Parcel_No), w = where(ap), d = txt(a.Work_Desc);
            push({ lat: w[0], lon: w[1], addr: txt(a.Address), d: isoDay(a.Status_Date), desc: d || txt(a.Activity_Code), type: [txt(a.Type), txt(a.Activity_Code)].filter(Boolean).join(', '), kind: /REROOF/i.test(a.Activity_Code || '') || /^\s*TEAR OFF/i.test(d) || reroofHead(d) ? 'reroof' : 'roofwork', val: +a.Valuation || 0, apn: ap, byApn: true, src: 'City of Sacramento' }); }))
          .catch(e => errs.push('Sacramento permits: ' + why(e)))); }); } }
    if (files.has('sj')) { const list = apns('06085'), RES = ['761b7ae8-3be1-4ad6-923d-c7af6404a904', 'df4b8461-0c7a-4d16-b85d-ff7f71c5fed5', '89ccdad9-7309-4826-a5f3-2fcf1fcb20fa'];
      for (let i = 0; i < list.length; i += 120) { const part = list.slice(i, i + 120); RES.forEach(id => { asked++; jobs.push(getJSON(EP.sjp + '?' + qs({ sql: `SELECT "ISSUEDATE","gx_location","ASSESSORS_PARCEL_NUMBER","WORKDESCRIPTION","SUBTYPEDESCRIPTION","FOLDERNAME","PERMITVALUATION","Status" FROM "${id}" WHERE "ASSESSORS_PARCEL_NUMBER" IN (${part.map(v => `'${v}'`).join(',')}) AND "WORKDESCRIPTION"='ReRoof'` }), { timeout: 30000 })
          .then(j => (((j.result || {}).records) || []).forEach(r => { const ap = digits(r.ASSESSORS_PARCEL_NUMBER), w = where(ap);
            push({ lat: w[0], lon: w[1], addr: txt(r.gx_location), d: isoDay(r.ISSUEDATE), desc: ['Re-roof', txt(r.FOLDERNAME)].filter(Boolean).join(': '), type: ['ReRoof', txt(r.SUBTYPEDESCRIPTION)].filter(Boolean).join(', '), kind: 'reroof', val: +r.PERMITVALUATION || 0, apn: ap, byApn: true, src: 'City of San Jose' }); }))
          .catch(e => errs.push('San Jose permits: ' + why(e)))); }); } }
    await Promise.all(jobs);
    out.forEach(p => { p.w = permitW(p); if (p.cov && p.cov.relay && p.kind === 'reroof') p.w = Math.max(p.w, 0.9); });
    return { list: out, errs: [...new Set(errs)], asked };
  }
