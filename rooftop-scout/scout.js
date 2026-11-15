/* ==== rooftop scout ==== */
/* Module 21, Rooftop Scout: the atlas's heatmaps laid over commercial satellite imagery, down to the single building.
   The ZIP heatmap of any layer in the shared catalog (the same LAYERS modules 01, 04, 05 and 06 draw) sits on Esri World
   Imagery: Vantor satellite imagery at about 30 cm, and 15 cm aerial imagery at the closest zoom across most of Dallas
   Fort Worth. At street level every building in view is fetched from FEMA's USA Structures inventory, joined to its
   county appraisal parcel (year built) and to the city's mechanical permits (the last time its heating and air
   conditioning was replaced), and read by the atlas's own models: what system it most likely has, how likely that
   system is to need a repair, a replacement or an installation, and which of the fourteen service lines that is.
   Green: likely to need the work. Orange: maybe. Red: not likely. A field check from the imagery overrides the model.
   Live Google Street View plays inside the map card, aimed from the street at the building, in place of the satellite map:
   Google's terms (Maps Platform 3.2.3(e)) keep Street View imagery and a non-Google map off the same screen, so the card
   switches between the two. With a Google Maps key (Maps JavaScript API) every building in the picture glows green, orange
   or red, drawn from the panorama's own camera so the glows follow the view. Street photos inside the side panel come from
   Mapillary when a Mapillary token is saved. Every request goes from this browser straight to a public service;
   nothing is sent anywhere else, and the keys a person saves stay in this browser.
   Plain script in the dashboard's own style, on the dashboard's own helpers (registerModule, mastHTML, card, callout,
   kpiHTML, dataTable, layerOptions, zipTip, qScale, legendHTML, saveFile, toCSV, store, toast). Leaflet 1.9.4 is carried
   inline beside it and kept private (window.__SCOUT_LEAFLET__), so no other module sees a global L. */
(function () {
  'use strict';
  if (typeof registerModule !== 'function' || typeof MODS === 'undefined' || typeof MODI === 'undefined' || MODI.rooftops) return;
  const LF = window.__SCOUT_LEAFLET__ || null;
  const KEY = 'rooftops', STORE = 'tda.scout.v1', CHECKS = 'tda.scout.checks.v1', VERSION = 1;
  const NUM = String(Math.max(0, ...MODS.map(m => +m.num || 0)) + 1).padStart(2, '0');
  const G0 = DATA.geo;
  const NOWD = new Date(), NOW = NOWD.getFullYear() + (NOWD.getMonth() + (NOWD.getDate() - 1) / 31) / 12, THIS_YEAR = NOWD.getFullYear();
  const TILE_Z = 16;                                                     /* buildings, parcels and permits are fetched per zoom 16 tile, about 600 by 500 m here */

  /* ---------- public services: every one keyless and open to a browser (CORS), checked 2026-11-15 ---------- */
  const EP = {
    esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/',
    esriKey: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/',
    bldg: 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query',
    parcel: 'https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer/identify',
    roads: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/',
    dallas: 'https://www.dallasopendata.com/resource/e7gq-4sah.json',
    fw: 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query',
    geocode: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
    mly: 'https://graph.mapillary.com/images',
  };

  /* ---------- settings, kept in this browser ---------- */
  const KINDS = { all: 'Every building', home: 'Homes', apt: 'Apartments and lodging', biz: 'Shops, offices and services', ind: 'Industrial and warehouses', inst: 'Schools, worship, health, government', other: 'Everything else' };
  /* green and orange cut points: an average DFW system scores about 45 (6.3% replaced a year, 21.5% calling for a repair), so
     orange is the typical home, green needs evidence of an older or original system, red needs evidence of recent work */
  const DEF = { imagery: 'esri', heat: 'idx', opacity: 0.55, minZoom: 17, green: 55, orange: 42, arcgisKey: '', mlyToken: '', gKey: '', show: { g: true, o: true, r: true }, kind: 'all', view: null };
  const CFG = (() => {
    const s = store.get(STORE, {}) || {}, o = JSON.parse(JSON.stringify(DEF));
    if (['esri', 'esri-labels', 'street'].includes(s.imagery)) o.imagery = s.imagery;
    if (typeof s.heat === 'string' && typeof LAYERS !== 'undefined' && LAYERS[s.heat]) o.heat = s.heat;
    if (isN(s.opacity)) o.opacity = clamp(+s.opacity, 0, 0.9);
    if ([16, 17, 18].includes(+s.minZoom)) o.minZoom = +s.minZoom;
    if (isN(s.green)) o.green = clamp(Math.round(+s.green), 10, 95);
    if (isN(s.orange)) o.orange = clamp(Math.round(+s.orange), 5, o.green - 1);
    if (typeof s.arcgisKey === 'string') o.arcgisKey = s.arcgisKey.trim().slice(0, 500);
    if (typeof s.mlyToken === 'string') o.mlyToken = s.mlyToken.trim().slice(0, 500);
    if (typeof s.gKey === 'string') o.gKey = s.gKey.trim().slice(0, 200);
    if (s.show && typeof s.show === 'object') ['g', 'o', 'r'].forEach(k => { o.show[k] = s.show[k] !== false; });
    if (KINDS[s.kind]) o.kind = s.kind;
    if (s.view && isN(s.view.lat) && isN(s.view.lon) && isN(s.view.z) && Math.abs(s.view.lat - 32.8) < 2 && Math.abs(s.view.lon + 97) < 2.5) o.view = { lat: +s.view.lat, lon: +s.view.lon, z: clamp(Math.round(+s.view.z), 8, 21) };
    return o;
  })();
  const saveCfg = () => store.set(STORE, CFG);
  /* field checks: what a person saw on the imagery, by building; the newest 1,500 are kept (this browser's storage is the
     dashboard's too, so the module keeps to about a tenth of a megabyte) */
  const CK = (() => { const o = store.get(CHECKS, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; })();
  function setCheck(id, patch) {
    const c = Object.assign({}, CK[id] || {}, patch, { at: new Date().toISOString() });
    if (!c.s && !(c.cues && c.cues.length) && !c.note) delete CK[id]; else { delete CK[id]; CK[id] = c; }
    const ks = Object.keys(CK); if (ks.length > 1500) ks.slice(0, ks.length - 1500).forEach(k => delete CK[k]);
    store.set(CHECKS, CK);
  }
  const CUES = [['old', 'Old, rusted or mismatched outdoor unit', 'g'], ['window', 'Window or wall units (no central air)', 'g'], ['hail', 'Hail damaged fins or panels', 'g'], ['rtu', 'Rooftop units visible', ''], ['new', 'New equipment', 'r'], ['work', 'Construction or renovation underway', '']];

  /* ---------- small things ---------- */
  const qs = o => Object.keys(o).filter(k => o[k] != null && o[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const meters = (a, b) => { const x = rad(b[1] - a[1]) * Math.cos(rad((a[0] + b[0]) / 2)), y = rad(b[0] - a[0]); return Math.sqrt(x * x + y * y) * 6371008.8; };
  const bearing = (a, b) => { const p1 = rad(a[0]), p2 = rad(b[0]), dl = rad(b[1] - a[1]); return (deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360; };
  const compass = h => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((h % 360) + 360) % 360 / 45) % 8];
  const pct = v => isN(v) ? Math.round(v * 100) + '%' : '—';
  const title = s => String(s || '').toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\b(Ne|Nw|Se|Sw|Fm|Ih|Us|Sh)\b/g, m => m.toUpperCase()).replace(/(\d)(St|Nd|Rd|Th)\b/g, (m, a, b) => a + b.toLowerCase());
  const ymd = ms => { const d = new Date(ms); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
  const monthYear = iso => { const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00Z' : iso); return isNaN(d) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const fracYear = iso => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso)); return m ? +m[1] + (+m[2] - 1 + (+m[3] - 1) / 31) / 12 : null; };
  const plural = (n, one, many) => `${N(n)} ${n === 1 ? one : (many || one + 's')}`;
  async function getJSON(url, o) {
    o = o || {};
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeout || 30000);
    try {
      const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' });
      let j = null; try { j = await r.json(); } catch (e) { j = null; }
      if (!r.ok) { const m = j && (j.message || (j.error && (j.error.message || j.error))); throw new Error('HTTP ' + r.status + (m && typeof m === 'string' ? ': ' + m.slice(0, 140) : '')); }
      if (j == null) throw new Error('the service sent no readable answer');
      if (!Array.isArray(j) && j.error) { const e = j.error; throw new Error(typeof e === 'string' ? e : ((e.message || j.message || 'the service refused the request') + (e.details && e.details.length ? ' (' + e.details.join(' ').slice(0, 120) + ')' : ''))); }
      return j;
    } catch (e) { if (e && e.name === 'AbortError') throw new Error('timed out'); throw e; }
    finally { clearTimeout(t); }
  }
  const why = e => String((e && e.message) || e || 'failed').slice(0, 160);

  /* ---------- the atlas's ZIP and county shapes, back to latitude and longitude ---------- */
  /* The SVG paths in DATA.geo are drawn in the atlas's own projection (02_map.js: x = (lon - minx) kx sx, y = (maxy - lat) sx,
     whole pixels, about 115 m each). Inverted here they make the heatmap polygons and answer which ZIP a building is in. */
  const unproj = (x, y) => [G0.maxy - y / G0.sx, G0.minx + x / (G0.kx * G0.sx)];
  function pathRings(d) {
    const rings = []; let cur = null, x = 0, y = 0, x0 = 0, y0 = 0; const re = /([MmLlHhVvZz])([^MmLlHhVvZz]*)/g; let m;
    while ((m = re.exec(String(d || '')))) {
      const c = m[1], v = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (c === 'M' || c === 'm') { for (let i = 0; i + 1 < v.length; i += 2) { if (c === 'm') { x += v[i]; y += v[i + 1]; } else { x = v[i]; y = v[i + 1]; } if (i === 0) { cur = [[x, y]]; rings.push(cur); x0 = x; y0 = y; } else cur.push([x, y]); } }
      else if (c === 'L' || c === 'l') { for (let i = 0; i + 1 < v.length; i += 2) { if (c === 'l') { x += v[i]; y += v[i + 1]; } else { x = v[i]; y = v[i + 1]; } if (cur) cur.push([x, y]); } }
      else if (c === 'H' || c === 'h') v.forEach(n => { x = c === 'h' ? x + n : n; if (cur) cur.push([x, y]); });
      else if (c === 'V' || c === 'v') v.forEach(n => { y = c === 'v' ? y + n : n; if (cur) cur.push([x, y]); });
      else { x = x0; y = y0; }
    }
    return rings.filter(r => r.length >= 3).map(r => r.map(([px, py]) => unproj(px, py)));
  }
  const bboxOf = rings => { let a = 90, b = 180, c = -90, d = -180; rings.forEach(r => r.forEach(([la, lo]) => { if (la < a) a = la; if (la > c) c = la; if (lo < b) b = lo; if (lo > d) d = lo; })); return [a, b, c, d]; };
  const inRing = (la, lo, r) => { let s = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const yi = r[i][0], xi = r[i][1], yj = r[j][0], xj = r[j][1]; if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) s = !s; } return s; };
  const inRings = (la, lo, rings) => rings.reduce((s, r) => inRing(la, lo, r) ? !s : s, false);
  const inBox = (la, lo, bb) => la >= bb[0] && la <= bb[2] && lo >= bb[1] && lo <= bb[3];
  const ZP = Object.entries(G0.zcta || {}).map(([zip, d]) => { const rings = pathRings(d); return { zip, rings, bb: bboxOf(rings) }; }).filter(p => p.rings.length);
  const ZPI = {}; ZP.forEach(p => ZPI[p.zip] = p);
  const CTY = Object.entries(G0.county || {}).map(([f, d]) => ({ fips: f, rings: pathRings(d) }));
  function zipAt(la, lo) {
    for (const p of ZP) if (inBox(la, lo, p.bb) && inRings(la, lo, p.rings)) return p.zip;
    let best = null, bd = 1e9; Z.forEach(z => { if (!isN(z.lat)) return; const d = meters([la, lo], [z.lat, z.lon]); if (d < bd) { bd = d; best = z.zip; } });
    return bd < 6000 ? best : null;
  }
  const DFW_BOUNDS = [[G0.maxy - G0.H / G0.sx, G0.minx], [G0.maxy, G0.minx + G0.W / (G0.kx * G0.sx)]];

  /* ---------- web mercator tiles ---------- */
  const lon2x = (lo, z) => Math.floor((lo + 180) / 360 * Math.pow(2, z));
  const lat2y = (la, z) => { const r = rad(la); return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); };
  const tileBox = (z, x, y) => { const n = Math.pow(2, z), n0 = deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)))), n1 = deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)))); return { w: x / n * 360 - 180, e: (x + 1) / n * 360 - 180, n: n0, s: n1 }; };
  const env = b => [b.w, b.s, b.e, b.n].map(v => v.toFixed(6)).join(',');

  /* ---------- addresses: one key for FEMA, the appraisal roll, Dallas and Fort Worth ---------- */
  /* "2012 IRONSIDE DRIVE", "2105 IRONSIDE DR, PLANO, TX 75075", "7151 GASTON AVE Ste:802" and Fort Worth's number and name
     fields all come down to number|core name: suffixes and directions dropped, units and cities cut off. */
  const SUF = { AVENUE: 'AVE', AV: 'AVE', AVE: 'AVE', STREET: 'ST', ST: 'ST', DRIVE: 'DR', DR: 'DR', ROAD: 'RD', RD: 'RD', LANE: 'LN', LN: 'LN', COURT: 'CT', CT: 'CT', CIRCLE: 'CIR', CIR: 'CIR', BOULEVARD: 'BLVD', BLVD: 'BLVD', PLACE: 'PL', PL: 'PL', PARKWAY: 'PKWY', PKWY: 'PKWY', TRAIL: 'TRL', TRL: 'TRL', TERRACE: 'TER', TER: 'TER', HIGHWAY: 'HWY', HWY: 'HWY', FREEWAY: 'FWY', FWY: 'FWY', EXPRESSWAY: 'EXPY', EXPY: 'EXPY', WAY: 'WAY', COVE: 'CV', CV: 'CV', CROSSING: 'XING', XING: 'XING', SQUARE: 'SQ', SQ: 'SQ', POINT: 'PT', PT: 'PT', RIDGE: 'RDG', RDG: 'RDG', LOOP: 'LOOP', PATH: 'PATH', PASS: 'PASS', RUN: 'RUN', ROW: 'ROW', ALLEY: 'ALY', ALY: 'ALY', BEND: 'BND', BND: 'BND', GLEN: 'GLN', GLN: 'GLN', GROVE: 'GRV', GRV: 'GRV', HOLLOW: 'HOLW', HOLW: 'HOLW', LANDING: 'LNDG', LNDG: 'LNDG', PLAZA: 'PLZ', PLZ: 'PLZ', TRACE: 'TRCE', TRCE: 'TRCE', VIEW: 'VW', VW: 'VW', VISTA: 'VIS', WALK: 'WALK', CREEK: 'CRK', CRK: 'CRK', HILL: 'HL', HILLS: 'HLS', MEADOW: 'MDW', MEADOWS: 'MDWS', SPRINGS: 'SPGS', VALLEY: 'VLY', ESTATES: 'ESTS', CANYON: 'CYN', BRANCH: 'BR', BROOK: 'BRK', BLUFF: 'BLF', CREST: 'CRST', FIELD: 'FLD', FIELDS: 'FLDS', GARDENS: 'GDNS', HEIGHTS: 'HTS', MANOR: 'MNR', OVAL: 'OVAL', PIKE: 'PIKE', SPUR: 'SPUR', STRAVENUE: 'STRA' };
  const DIRS = { NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW', N: 'N', S: 'S', E: 'E', W: 'W', NE: 'NE', NW: 'NW', SE: 'SE', SW: 'SW' };
  const isDir = w => /^(N|S|E|W|NE|NW|SE|SW)$/.test(w), isSuf = w => Object.prototype.hasOwnProperty.call(SUF, w);
  function addrParts(s) {
    let t = String(s == null ? '' : s).toUpperCase().split(',')[0].replace(/\b(STE|SUITE|UNIT|APT|BLDG|SPC|LOT|RM|FL)\b\s*[:#.]?\s*[A-Z0-9-]*/g, ' ').replace(/#\s*[A-Z0-9-]+/g, ' ').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const w = t.split(' ').filter(Boolean); let num = '';
    if (w.length && /^\d+[A-Z]?$/.test(w[0])) num = w.shift().replace(/[A-Z]$/, '');
    let core = w.map(x => DIRS[x] && x.length > 2 ? DIRS[x] : x);
    for (let k = 0; k < 2 && core.length > 1 && (isDir(core[core.length - 1]) || isSuf(core[core.length - 1])); k++) core.pop();
    if (core.length > 1 && isDir(core[0])) core.shift();
    const street = core.join(' ');
    return { num, street, key: num && street ? num + '|' + street : '' };
  }

  /* ---------- what a building is: FEMA's occupancy class to an HVAC profile ---------- */
  const CLS = {
    'Single Family Dwelling': 'sf', 'Multi - Family Dwelling': 'mf', 'Manufactured Home': 'mh', 'Temporary Lodging': 'hotel', 'Nursing Home': 'care', 'Institutional Dormitory': 'dorm',
    'Retail Trade': 'retail', 'Wholesale Trade': 'whse', 'Professional/Technical Services': 'office', 'Personal and Repair Services': 'svc', 'Entertainment and Recreation': 'ent', 'Medical Office/Clinic': 'med', 'Parking': 'parking', 'Hospital': 'hosp', 'Veterinary/Pet': 'vet', 'Theaters': 'theater', 'Banks': 'bank',
    'General Services': 'gov', 'Emergency Response': 'fire', 'Non-Civilian Structures': 'mil', 'Pre-K - 12 Schools': 'school', 'Other Educational Buildings': 'edu', 'Colleges/Universities': 'college',
    'Religious': 'church', 'Community Center': 'community', 'Indoor Arena': 'arena', 'Convention Center': 'conv', 'Agriculture': 'ag', 'Light': 'ind', 'Heavy': 'indh', 'Food/Drugs/Chemicals': 'indf', 'Metals/Minerals Processing': 'indh',
    'Aviation': 'avn', 'Ground': 'util', 'Rail': 'util', 'Marine': 'util', 'Energy Control Monitoring': 'util',
  };
  /* l: plain name; kind: the filter group; spt: square feet of floor a ton of cooling serves (a rule of thumb, judgment) */
  const PROF = {
    sf: { l: 'Single family home', kind: 'home' }, mf: { l: 'Apartments or multifamily', kind: 'apt' }, mh: { l: 'Manufactured home', kind: 'home' }, hotel: { l: 'Hotel or motel', kind: 'apt' },
    care: { l: 'Nursing or care home', kind: 'inst', spt: 300 }, dorm: { l: 'Dormitory', kind: 'inst', spt: 350 }, retail: { l: 'Retail', kind: 'biz', spt: 350 }, whse: { l: 'Warehouse or wholesale', kind: 'ind', spt: 350 },
    office: { l: 'Office or professional services', kind: 'biz', spt: 375 }, svc: { l: 'Personal and repair services', kind: 'biz', spt: 350 }, ent: { l: 'Entertainment and recreation', kind: 'biz', spt: 300 },
    med: { l: 'Medical office or clinic', kind: 'inst', spt: 300 }, parking: { l: 'Parking structure', kind: 'other' }, hosp: { l: 'Hospital', kind: 'inst', spt: 250 }, vet: { l: 'Veterinary or pet care', kind: 'biz', spt: 300 },
    theater: { l: 'Theater', kind: 'biz', spt: 250 }, bank: { l: 'Bank', kind: 'biz', spt: 350 }, gov: { l: 'Government building', kind: 'inst', spt: 375 }, fire: { l: 'Fire, police or EMS station', kind: 'inst', spt: 375 },
    mil: { l: 'Secure or military structure', kind: 'inst', spt: 375 }, school: { l: 'School, pre K to 12', kind: 'inst', spt: 375 }, edu: { l: 'Educational building', kind: 'inst', spt: 375 }, college: { l: 'College or university building', kind: 'inst', spt: 350 },
    church: { l: 'Place of worship', kind: 'inst', spt: 325 }, community: { l: 'Community center', kind: 'inst', spt: 350 }, arena: { l: 'Indoor arena', kind: 'inst', spt: 250 }, conv: { l: 'Convention center', kind: 'inst', spt: 250 },
    ag: { l: 'Farm building', kind: 'other' }, ind: { l: 'Light industrial', kind: 'ind', spt: 400 }, indh: { l: 'Heavy industrial', kind: 'ind', spt: 400 }, indf: { l: 'Food, drug or chemical plant', kind: 'ind', spt: 300 },
    avn: { l: 'Aviation building', kind: 'other', spt: 400 }, util: { l: 'Utility or transport shelter', kind: 'other' }, shed: { l: 'Shed or small outbuilding', kind: 'other' },
    garage: { l: 'Detached garage or accessory building', kind: 'home' }, unk: { l: 'Building, use not recorded', kind: 'other', spt: 375 },
  };
  function classify(p) {
    const prim = String(p.PRIM_OCC || '').trim(), occ = String(p.OCC_CLS || '').trim(), sq = +p.SQFEET || 0;
    const c = CLS[prim]; if (c) return c;
    if (sq && sq < 260) return 'shed';
    if (occ === 'Residential') return sq < 950 ? 'garage' : 'sf';
    return sq && sq < 600 ? 'shed' : 'unk';
  }

  /* ---------- equipment life: the atlas's own Weibull tables (RECS 2020 Texas, module 02) and a renewal model ---------- */
  const WB = (META && META.weib_all) || {};
  const life = (k, d) => (WB[k] && isN(WB[k].lam) && isN(WB[k].k) ? { lam: +WB[k].lam, k: +WB[k].k, src: k } : d);
  const LIFE = {
    ac: life('AC_TX', { lam: 17.69, k: 2.14 }), hp: life('HP_TX', { lam: 16.51, k: 1.92 }), gf: life('GasFurn_TX', { lam: 20.55, k: 2.42 }),
    rtu: life('AC_TX', { lam: 17.69, k: 2.14 }),          /* packaged rooftop units ride the cooling table (ASHRAE's median for them is 15 years) */
    plant: { lam: 26, k: 2.6 },                            /* chillers, towers and boilers: ASHRAE medians of 20 to 25 years and more (judgment) */
    ptac: { lam: 11.5, k: 2.2 },                           /* through the wall units: ASHRAE median 10 years (judgment) */
  };
  const HMAX = 170, REN = {};
  /* u[n]: the chance a system is installed in year n of the clock (n = 0 is the first install); S[a]: the chance one lasts a years */
  function renewal(key) {
    if (REN[key]) return REN[key];
    const p = LIFE[key], L = HMAX + 12, S = new Float64Array(L), f = new Float64Array(L), u = new Float64Array(L);
    for (let a = 0; a < L; a++) S[a] = Math.exp(-Math.pow(a / p.lam, p.k));
    for (let a = 0; a < L - 1; a++) f[a] = S[a] - S[a + 1];
    u[0] = 1; for (let n = 1; n < L; n++) { let s = 0; for (let m = 0; m < n; m++) s += u[m] * f[n - m - 1]; u[n] = s; }
    return (REN[key] = { S, u });
  }
  /* repair calls a year by system age: module 05's bands (10% to 45%), which reproduce the atlas's repair counts within 1% */
  const repairRate = a => a < 5 ? 0.10 : a < 10 ? 0.18 : a < 15 ? 0.28 : a < 20 ? 0.36 : 0.45;
  /* the system now in place, for a clock started in year y0: still original, 15 or older, installed in the R22 era (before
     2010), replaced within five years, replaced within twelve months, a repair call within twelve months, mean age */
  const SMEMO = new Map();
  function stateAt(key, y0) {
    const mk = key + '|' + y0; if (SMEMO.has(mk)) return SMEMO.get(mk);
    const R = renewal(key), t = clamp(Math.round(NOW - (y0 + 0.5)), 0, HMAX);
    let pOld = 0, pR22 = 0, surv5 = 0, rep = 0, age = 0;
    for (let m = 0; m <= t; m++) { const a = t - m, w = R.u[m] * R.S[a]; if (a >= 15) pOld += w; if (y0 + m <= 2009) pR22 += w; surv5 += R.u[m] * R.S[a + 5]; rep += w * repairRate(a); age += w * a; }
    const o = { pOrig: R.S[t], pOld, pR22, p5: clamp(1 - surv5, 0, 1), p1: R.u[t + 1], rep, age, t };
    SMEMO.set(mk, o); return o;
  }
  const ST_KEYS = ['pOrig', 'pOld', 'pR22', 'p5', 'p1', 'rep', 'age', 't'];
  function mixStates(list) { const o = {}; ST_KEYS.forEach(k => o[k] = 0); let W = 0; list.forEach(([s, w]) => { W += w; ST_KEYS.forEach(k => o[k] += s[k] * w); }); if (W > 0) ST_KEYS.forEach(k => o[k] /= W); return o; }

  /* ---------- when a building was built, when its year is not on file ---------- */
  /* The ZIP's ACS year built mix (the same ten bins module 01 draws), sharpened for a house by its footprint: an old
     neighborhood's big footprint is more likely a rebuild, a small one more likely original. The footprint medians are a
     judgment call from DFW tract housing, set wide (a log spread of 0.38) so they lean, not decide. */
  const BINS = [[2020, 2025], [2010, 2019], [2000, 2009], [1990, 1999], [1980, 1989], [1970, 1979], [1960, 1969], [1950, 1959], [1940, 1949], [1905, 1939]];
  const BIN_L = ['2020 or later', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', 'before 1940'];
  const FOOT = [2500, 2650, 2700, 2550, 2200, 1950, 1700, 1350, 1200, 1400];
  const NOC = [0.005, 0.005, 0.01, 0.015, 0.03, 0.06, 0.10, 0.16, 0.20, 0.24];     /* homes without central air by era (judgment; RECS 2020 Texas: 10.6% of homes that cool use room units, apartments included) */
  const binOf = y => { for (let i = 0; i < BINS.length; i++) if (y >= BINS[i][0]) return i; return BINS.length - 1; };
  function ybPrior(b) {
    const z = b.z; let w = z && Array.isArray(z.yb) && sum(z.yb) > 0 ? z.yb.map(v => Math.max(0, +v || 0)) : (Array.isArray(META.yb) ? META.yb.map(v => +v || 0) : BINS.map(() => 1));
    if (b.cls === 'sf' && b.sqft > 300) { const ls = Math.log(b.sqft); w = w.map((v, i) => v * Math.exp(-Math.pow(ls - Math.log(FOOT[i]), 2) / (2 * 0.38 * 0.38))); }
    const s = sum(w) || 1; return w.map(v => v / s);
  }
  const sampleYears = i => { const [a, b] = BINS[i]; return i === BINS.length - 1 ? [1915, 1928, 1937] : [a + 1, Math.round((a + b) / 2), b - 1]; };

  /* ---------- the likely system ---------- */
  const storiesRes = h => !(h > 0) ? 1 : h < 7.2 ? 1 : h < 10.8 ? 2 : 3;
  const floorsCom = h => !(h > 0) ? 1 : clamp(Math.round((h - 1) / 4), 1, 80);
  const tonsTxt = t => { if (t >= 20) return N(Math.round(t / 5) * 5); const r = Math.max(1.5, Math.round(t * 2) / 2); return (r % 1 ? r.toFixed(1) : String(r)); };
  const CTRL = {
    res: 'A thermostat for each system. Fresh air ventilation, dehumidification and better filtration are add on jobs (the Indoor Air line).',
    mfu: 'A thermostat in each unit; corridors and common rooms on their own small systems.',
    rtu: 'Thermostats or a small building automation system; the rooftop units bring in the outside air, the larger ones through an economizer.',
    plant: 'A building automation system runs the chillers, boilers and air handlers; ventilation, humidity and pressure are set centrally.',
    ptac: 'A control on each room unit; corridors ventilated by a make up air unit.',
    crit: 'Environmental control is critical here: room pressure, humidity and filtration are held to code and checked.',
    ind: 'Unit heater thermostats and exhaust or ventilation fans; little comfort cooling outside the offices.',
    none: 'No comfort conditioning expected.',
  };
  /* The profile a building most likely runs: name, odds across the common types, units, size, the life table the model ages it
     with, controls, and the share of the building a heating and air contractor would expect to condition (factor). */
  function systemOf(b) {
    const z = b.z || {}, c = b.cls, sq = b.sqft || 0, h = b.h || 0, P = PROF[c] || PROF.unk;
    const gas = clamp(isN(z.gas_sh) ? z.gas_sh / 100 : (META.gas_msa || 37.3) / 100, 0, 1), elec = clamp(isN(z.elec_sh) ? z.elec_sh / 100 : (META.elec_msa || 61.6) / 100, 0, 1);
    const g = gas / ((gas + elec) || 1), e = 1 - g;
    const res = (gShare, hpOfE) => [['Gas furnace with central AC', g * gShare / ((g * gShare + e) || 1)], ['Heat pump', e * hpOfE / ((g * gShare + e) || 1)], ['Electric furnace (strip heat) with central AC', e * (1 - hpOfE) / ((g * gShare + e) || 1)]].sort((a, b) => b[1] - a[1]);
    const o = { life: 'res', units: 1, factor: 1, controls: CTRL.res, mix: null, size: '', name: '', short: '', hp: e * 0.47, gas: g };
    if (c === 'sf') {
      const st = storiesRes(h), living = sq * 0.82 * st, yb = b.yb || b.ybMid || 1995, tons = living / (yb >= 2000 ? 600 : 500), n = living > 5800 ? 3 : living > 3300 ? 2 : 1;
      o.mix = res(1, 0.47); o.units = n; o.hp = o.mix.find(m => m[0] === 'Heat pump')[1];
      o.name = 'Split system: ' + (o.mix[0][0] === 'Heat pump' ? 'heat pump outside, air handler and coil in the attic or a closet' : o.mix[0][0] === 'Gas furnace with central AC' ? 'AC condenser outside, gas furnace and coil in the attic' : 'AC condenser outside, electric air handler with strip heat inside');
      o.short = o.mix[0][0]; o.size = `${st === 1 ? 'One story' : st + ' stories'}, about ${N(Math.round(living / 50) * 50)} sq ft lived in; ${n > 1 ? n + ' systems (zoned floors), about ' + tonsTxt(tons) + ' tons together' : 'about ' + tonsTxt(tons) + ' tons'}`;
    } else if (c === 'mh') {
      o.mix = res(0.7, 0.45); o.hp = o.mix.find(m => m[0] === 'Heat pump')[1]; o.short = 'Packaged unit or split, downflow furnace';
      o.name = 'Packaged unit or a split system feeding a downflow furnace under the floor (electric strip heat or a heat pump, gas where it is piped)'; o.size = `about ${tonsTxt(Math.max(1.5, sq / 600))} tons`;
    } else if (c === 'mf') {
      const fl = clamp(Math.round((h - 1.5) / 3.3), 1, 60), gross = sq * fl, units = Math.max(2, Math.round(gross * 0.85 / 900));
      if (fl >= 5 || (gross > 120000 && fl >= 4)) { Object.assign(o, { life: 'plant', units: Math.max(1, Math.round(gross / 150000)) + 1, controls: CTRL.plant, short: 'Central plant with fan coils or water source heat pumps', name: 'Central plant: chillers or a cooling tower serving fan coils or water source heat pumps in each unit, boilers for heat' }); o.size = `${fl} floors, about ${N(units)} units`; }
      else { o.mix = res(0.6, 0.53); o.hp = o.mix.find(m => m[0] === 'Heat pump')[1]; o.units = units; o.controls = units <= 4 ? CTRL.res : CTRL.mfu; o.short = units <= 4 ? 'A split system per unit' : 'Split systems or heat pumps per unit';
        o.name = units <= 4 ? 'One split system per unit (duplex to fourplex), condensers beside the building' : 'A split system or heat pump for each unit, condensers on the ground or the roof; electric heat is the norm in DFW apartments'; o.size = `${fl === 1 ? 'One story' : fl + ' stories'}, about ${N(units)} units, ${tonsTxt(units * 1.75)} tons in all`; }
    } else if (c === 'hotel') {
      const fl = floorsCom(h), rooms = Math.max(8, Math.round(sq * fl / 450));
      Object.assign(o, { life: 'ptac', units: rooms, controls: CTRL.ptac, short: 'PTAC in each room', name: fl >= 6 ? 'Through the wall units (PTAC or vertical units) in each room; a central plant or rooftop units for the common areas' : 'PTAC through the wall units in each room; packaged rooftop or split units for the lobby and corridors', size: `about ${N(rooms)} rooms` });
    } else if (c === 'parking') Object.assign(o, { life: 'none', factor: 0.04, controls: CTRL.none, short: 'Ventilation only', name: 'Ventilation only: exhaust fans and carbon monoxide controls; no comfort cooling expected', size: '' });
    else if (c === 'shed') Object.assign(o, { life: 'none', factor: 0.05, controls: CTRL.none, short: 'None expected', name: 'None expected: a shed or small outbuilding', size: '' });
    else if (c === 'garage') Object.assign(o, { life: 'none', factor: 1, controls: CTRL.none, short: 'None expected; a ductless mini split if it is lived in', name: 'Usually none. A ductless mini split if it is used as a workshop, a gym or living space', size: `${N(Math.round(sq / 10) * 10)} sq ft footprint` });
    else if (c === 'ag') Object.assign(o, { life: 'res', factor: 0.3, controls: CTRL.ind, short: 'Usually unconditioned', name: 'Usually unconditioned (barns and sheds); a farm office or shop may have a split system or a window unit', size: '' });
    else if (c === 'util') Object.assign(o, { life: 'rtu', units: 2, factor: 0.45, controls: CTRL.ind, short: 'Wall mounted packaged units', name: 'Equipment shelter: wall mounted packaged units, often two running lead and lag', size: '' });
    else if (c === 'whse' || c === 'ind' || c === 'indh' || c === 'indf' || c === 'avn') {
      const office = sq * (c === 'indf' ? 0.25 : 0.12), tons = office / 350, n = Math.max(1, Math.round(tons / 8.5));
      Object.assign(o, { life: 'rtu', units: n, factor: c === 'indf' ? 0.85 : c === 'indh' ? 0.6 : 0.7, controls: c === 'indf' ? CTRL.crit : CTRL.ind, short: c === 'indf' ? 'Process cooling, make up air, rooftop units' : 'Unit heaters on the floor, rooftop units over the office',
        name: c === 'indf' ? 'Process cooling and make up air with tight temperature, humidity and filtration control; rooftop units over the offices' : c === 'avn' ? 'Gas unit heaters or radiant heat in the hangar; rooftop or split units for the offices' : 'Gas unit heaters and big fans on the warehouse floor; a rooftop or split unit for the office', size: `about ${N(Math.round(sq / 100) * 100)} sq ft under roof, ${n === 1 ? 'one office unit' : n + ' office units'} likely` });
    } else {
      /* shops, offices, schools, worship, health, government, arenas and the unrecorded: packaged rooftop units up to a size, then a central plant */
      const fl = floorsCom(h), gross = sq * fl, spt = P.spt || 375, tons = gross / spt;
      const plant = c === 'hosp' || ((c === 'college' || c === 'arena' || c === 'conv') && gross > 40000) || fl >= 5 || (gross >= 200000 && fl >= 2);
      if (plant) Object.assign(o, { life: 'plant', units: 1 + Math.min(3, Math.floor(gross / 150000)), controls: c === 'hosp' ? CTRL.crit + ' ' + CTRL.plant : CTRL.plant, short: 'Central plant: chillers, boilers, air handlers', name: c === 'hosp' ? 'Central plant: chillers, cooling towers, boilers and air handlers, with critical ventilation, pressure and humidity control' : 'Central plant: water cooled chillers and a cooling tower, boilers, air handlers with VAV boxes', size: `${fl === 1 ? 'One story' : fl + ' floors'}, about ${N(Math.round(gross / 1000) * 1000)} sq ft, near ${N(Math.round(tons / 10) * 10)} tons` });
      else if (gross < 1800) Object.assign(o, { life: 'rtu', units: 1, controls: CTRL.rtu, short: 'Split system or a small packaged unit', name: 'A split system or a small packaged unit', size: `about ${tonsTxt(tons)} tons` });
      else {
        const big = sq >= 60000 && fl <= 2, n = Math.max(1, Math.round(tons / (big ? 12 : 8.5)));
        Object.assign(o, { life: 'rtu', units: n, controls: c === 'med' || c === 'care' || c === 'vet' ? CTRL.crit + ' ' + CTRL.rtu : CTRL.rtu, short: n === 1 ? 'Packaged rooftop unit' : 'Packaged rooftop units',
          name: c === 'school' ? 'Packaged rooftop units on the older wings; chillers with air handlers, or VRF, on newer buildings' : c === 'church' ? 'Several split systems or packaged rooftop units: sanctuary, hall and classrooms on their own zones' : c === 'fire' ? 'Split systems or rooftop units for the living quarters; gas unit heaters and exhaust in the apparatus bays' : big ? 'Many packaged rooftop units (a big box roof), gas heat' : `Packaged rooftop unit${n === 1 ? '' : 's'} with gas heat`,
          size: `${fl === 1 ? 'One story' : fl + ' floors'}, about ${N(Math.round(gross / 100) * 100)} sq ft; about ${n === 1 ? 'one unit' : N(n) + ' units'}, ${tonsTxt(tons)} tons in all` });
      }
      if (c === 'care' || c === 'dorm') { o.short = o.life === 'plant' ? o.short : 'Rooftop units, PTACs in the rooms'; o.name = o.life === 'plant' ? o.name + '; through the wall units in resident rooms' : 'Packaged rooftop units for the common areas and through the wall units (PTAC) in the rooms'; }
    }
    return o;
  }

  /* ---------- reading a building ---------- */
  const lifeKeys = sys => sys.life === 'res' ? [['ac', 1 - (sys.hp || 0)], ['hp', sys.hp || 0]] : sys.life === 'none' ? [] : [[sys.life, 1]];
  /* how much a mechanical permit moves the clock: a replacement or a new system resets it; a repair barely does */
  function permitWeight(p, b) {
    const d = String(p.desc || '').toUpperCase(); let w = /REPLAC|CHANGE ?OUT|C\/O|INSTALL|NEW (HVAC|SYSTEM|UNIT|AC|A\/C|FURN|HEAT|CONDENS)|SWAP|UPGRADE|TON/.test(d) ? 0.9 : /REPAIR|RECHARGE|LEAK|DUCT|THERMOSTAT|VENT|EXHAUST|HOOD|GAS (LINE|TEST)/.test(d) ? 0.45 : 0.75;
    if (p.newc) w = 0.95;
    if (b.sys && b.sys.units > 1) w *= clamp(b.permits.filter(q => NOW - q.y < 8).length / b.sys.units, 0.15, 1);   /* one unit's permit is not the building's */
    return w;
  }
  function read(b) {
    b.sys = systemOf(b);
    const sys = b.sys, keys = lifeKeys(sys);
    /* the start of the clock: the year built on file, or the ZIP's mix of years */
    let starts, prior = null;
    if (b.yb) { starts = [[b.yb, 1]]; b.ybMid = b.yb; }
    else { prior = ybPrior(b); starts = []; prior.forEach((w, i) => { if (w > 1e-4) sampleYears(i).forEach(y => starts.push([y, w / 3])); }); b.ybMid = Math.round(sum(starts.map(s => s[0] * s[1]))); b.prior = prior; }
    const stateFrom = list => keys.length ? mixStates(list.flatMap(([y, w]) => keys.map(([k, kw]) => [stateAt(k, y), w * kw]))) : { pOrig: 0, pOld: 0, pR22: 0, p5: 0, p1: 0, rep: 0, age: 0, t: 0 };
    let st = stateFrom(starts);
    const hv = b.permits.filter(p => !p.newc || !b.ybFromPermit).sort((x, y) => y.y - x.y);
    const last = hv[0] || null;
    if (last && keys.length) { const w = permitWeight(last, b); const fresh = stateFrom([[Math.floor(last.y), 1]]); const o = {}; ST_KEYS.forEach(k => o[k] = w * fresh[k] + (1 - w) * st[k]); st = o; b.lastW = w; }
    b.state = st; b.last = last;
    /* installation: a home old and small enough that it may still cool with window units */
    let inst = 0;
    if (b.cls === 'sf' || b.cls === 'mh' || (b.cls === 'mf' && sys.units <= 4)) {
      inst = b.yb ? NOC[binOf(b.yb)] : sum((prior || []).map((w, i) => w * NOC[i]));
      /* size counts in full only when the year is on file: without it the footprint has already leaned the era (ybPrior) */
      const living = (b.sqft || 0) * 0.82 * storiesRes(b.h), sf = living && living < 1000 ? 1.4 : living < 1400 ? 1.15 : living > 2600 ? 0.5 : 1; inst *= b.yb ? sf : Math.sqrt(sf);
      const inc = b.z && b.z.inc; inst *= !isN(inc) ? 1 : inc < 45000 ? 1.3 : inc < 65000 ? 1.1 : inc > 120000 ? 0.6 : 1;
      if (b.cls === 'mf') inst *= 1.15; if (last) inst *= 0.2;
      inst = clamp(inst, 0, 0.35);
    } else if (b.cls === 'garage') inst = 0.1;
    /* hail: golf ball hail inside 8 km since 2023 bends condenser fins and dents rooftop units */
    const hr = b.z ? clamp((+b.z.hail_recent || 0) / 12, 0, 1) : 0, hail = sys.life === 'none' ? 0 : hr * (sys.life === 'rtu' ? 0.10 : sys.life === 'res' ? 0.07 : 0.03);
    const n = Math.max(1, sys.units || 1), ne = n > 1 ? Math.sqrt(n) : 1;
    const P5 = keys.length ? 1 - Math.pow(1 - st.p5, ne) : 0, REP = keys.length ? 1 - Math.pow(1 - st.rep, ne) : 0;
    const need = clamp((1 - (1 - P5) * (1 - REP) * (1 - inst) * (1 - hail)) * sys.factor, 0, 1);
    b.sc = { P5, REP, inst, hail, need, score: Math.round(need * 100) };
    /* what the work most likely is */
    const opts = [['replace', P5], ['repair', REP * 0.85], ['install', inst * 1.8]].sort((x, y) => y[1] - x[1]);
    const nk = (sys.factor < 0.1 || sys.life === 'none') && !inst ? 'none' : sys.life === 'none' ? 'install' : opts[0][0];
    /* "original" means the builder's system only while the clock starts at the year built; after a permit it is that job's system */
    const reset = !!(last && b.lastW >= 0.6), firstwave = !reset && st.pOrig >= 0.35 && st.t >= 10 && st.t <= 25, permAge = reset ? Math.round(NOW - last.y) : 0;
    b.need = { k: nk, l: nk === 'replace' ? (reset && permAge >= 12 ? `Replacement: the system put in around ${Math.floor(last.y)} is about ${permAge} years old` : st.pR22 >= 0.4 ? 'Replacement: an R22 era system is likely' : firstwave ? 'Replacement: the builder\'s original system is likely' : 'Replacement') : nk === 'repair' ? 'Repair' : nk === 'install' ? (b.cls === 'garage' ? 'Installation: a ductless mini split, if it is lived in' : 'Installation: no central air is likely') : 'No HVAC work expected' };
    /* the atlas's service lines it falls under */
    const L = [], add = id => { if (!L.includes(id) && SLM.LI && SLM.LI[id]) L.push(id); }, com = !['sf', 'mh', 'garage', 'mf', 'shed', 'parking'].includes(b.cls);
    if (com && sys.life !== 'none') add('commercial');
    if (nk === 'install') { if (b.cls === 'garage') add('ductless'); else { add('replace'); add('ductless'); } }
    if (nk === 'replace') { if (st.pR22 >= 0.35) add('r22'); if (firstwave) add('firstwave'); add(sys.life === 'res' && (sys.hp || 0) > 0.5 ? 'heatpump' : 'replace'); if (sys.life === 'res' && (sys.gas || 0) > 0.5 && st.age >= 12) add('furnace'); }
    if (REP >= 0.25 && sys.life !== 'none') add('repair');
    const m = NOWD.getMonth(); if ((m >= 9 || m <= 2) && sys.life === 'res' && (sys.gas || 0) > 0.4 && sys.factor > 0.5) add('heat');
    if (hail >= 0.04) add('hail');
    if (b.cls === 'mf') add('landlord');
    if (sys.life !== 'none' && sys.factor > 0.5) add('maint');
    b.lines = L.slice(0, 4);
    statusOf(b);
    return b;
  }
  function statusOf(b) { const ck = CK[b.id]; b.status = ck && ck.s ? ck.s : b.sc.score >= CFG.green ? 'g' : b.sc.score >= CFG.orange ? 'o' : 'r'; b.checked = !!ck; return b.status; }
  /* the need as the card and the table say it: a building in red that nobody has checked is told as upkeep, not as a job */
  const needLabel = b => b.need.k === 'none' ? b.need.l : b.status === 'r' && !(CK[b.id] && CK[b.id].s) ? (b.sys.life === 'none' ? 'No HVAC work expected' : 'Not likely now: maintenance and tune ups') : b.need.l;
  const STL = { g: 'Likely needs work', o: 'Maybe', r: 'Not likely' }, STS = { g: 'Likely', o: 'Maybe', r: 'Not likely' };

  /* ---------- the store of buildings and tiles ---------- */
  const B = new Map(), T = new Map();
  const PCOV = { '48439': 'yes', '48085': 'yes', '48121': 'yes', '48497': 'yes' };   /* counties whose appraisal roll carries a year built in the statewide parcel file; the rest are probed once */
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
        const a = addrParts(p.PROP_ADDR);
        b = { id, bid: p.BUILD_ID, rings, bb, lat: la, lon: lo, occ: p.OCC_CLS || '', prim: p.PRIM_OCC || '', cls: classify(p), sqft: +p.SQFEET || 0, h: +p.HEIGHT || 0,
          addr: p.PROP_ADDR ? String(p.PROP_ADDR) : '', addrSrc: p.PROP_ADDR ? 'fema' : '', akey: a.key, street: a.street, city: String(p.PROP_CITY || '').toUpperCase(), zipF: p.PROP_ZIP ? String(p.PROP_ZIP).slice(0, 5) : '',
          yb: null, ybSrc: '', parcel: null, permits: [], tiles: new Set(), lay: null };
        b.zip = (b.zipF && ZI[b.zipF] && ZPI[b.zipF] && inBox(la, lo, ZPI[b.zipF].bb) ? b.zipF : '') || zipAt(la, lo) || b.zipF;
        b.z = ZI[b.zip] || null; b.fips = b.z ? b.z.fips : null;
        B.set(id, b);
      }
      b.tiles.add(t.k); t.ids.add(id); out.push(b);
    });
    /* FEMA gives a detached garage or a back house the main house's class and address: on a shared address, a small second
       structure (under 900 sq ft and under 60% of the largest) is read as the accessory building it most likely is */
    const by = {}; out.forEach(b => { if (b.akey && b.cls === 'sf') (by[b.akey] = by[b.akey] || []).push(b); });
    Object.values(by).forEach(g => { if (g.length < 2) return; const main = g.reduce((m, b) => (b.sqft > m.sqft ? b : m), g[0]); g.forEach(b => { if (b !== main && b.sqft < 900 && b.sqft < 0.6 * main.sqft) { b.cls = 'garage'; b.acc = true; } }); });
    return out;
  }
  async function fetchBuildings(box, depth) {
    const u = EP.bldg + '?' + qs({ where: '1=1', geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'BUILD_ID,OCC_CLS,PRIM_OCC,PROP_ADDR,PROP_CITY,PROP_ZIP,HEIGHT,SQFEET,LATITUDE,LONGITUDE,UUID', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'geojson' });
    const j = await getJSON(u, { timeout: 40000 });
    /* the service sends at most 2,000 buildings and does not page: a fuller box is asked again as four quarters */
    if (j.properties && j.properties.exceededTransferLimit && (depth || 0) < 2) {
      const mx = (box.w + box.e) / 2, my = (box.s + box.n) / 2, q = [{ w: box.w, e: mx, s: box.s, n: my }, { w: mx, e: box.e, s: box.s, n: my }, { w: box.w, e: mx, s: my, n: box.n }, { w: mx, e: box.e, s: my, n: box.n }];
      const parts = await Promise.all(q.map(x => fetchBuildings(x, (depth || 0) + 1)));
      return { features: parts.flatMap(p => p.features || []) };
    }
    return j;
  }
  /* the appraisal roll: every parcel in the tile with its shape, joined to the buildings whose centre falls inside it */
  async function fetchParcels(t) {
    const u = EP.parcel + '?' + qs({ geometry: env(t.box), geometryType: 'esriGeometryEnvelope', sr: 4326, layers: 'all:0', tolerance: 0, mapExtent: env(t.box), imageDisplay: '1024,1024,96', returnGeometry: 'true', maxAllowableOffset: 0.000004, geometryPrecision: 6, f: 'json' });
    const j = await getJSON(u, { timeout: 40000 });
    return (j.results || []).map(r => { const a = r.attributes || {}, rings = ((r.geometry && r.geometry.rings) || []).map(rg => rg.map(([lo, la]) => [la, lo])); const yb = parseInt(a.YEAR_BUILT, 10);
      return { rings, bb: rings.length ? bboxOf(rings) : null, yb: yb > 1800 && yb <= THIS_YEAR ? yb : null, situs: a.SITUS_ADDR && a.SITUS_ADDR !== 'Null' ? String(a.SITUS_ADDR).split(',')[0].trim() : '', src: a.SOURCE && a.SOURCE !== 'Null' ? String(a.SOURCE) : '', tax: a.TAX_YEAR && a.TAX_YEAR !== 'Null' ? String(a.TAX_YEAR) : '' }; });
  }
  function joinParcels(t, parcels) {
    t.ids.forEach(id => { const b = B.get(id); if (!b || b.parcel) return; const p = parcels.find(q => q.bb && inBox(b.lat, b.lon, q.bb) && inRings(b.lat, b.lon, q.rings)); if (!p) return;
      b.parcel = { yb: p.yb, situs: p.situs, src: p.src, tax: p.tax };
      if (p.yb && !b.yb) { b.yb = p.yb; b.ybSrc = 'parcel'; }
      if (!b.addr && p.situs && /^\d/.test(p.situs)) { b.addr = p.situs; b.addrSrc = 'parcel'; const a = addrParts(p.situs); b.akey = a.key; b.street = a.street; } });
  }
  /* mechanical permits on the streets of the tile: Dallas from 2018, Fort Worth from 2001 */
  const cityOf = b => { if (b.city === 'DALLAS') return 'dal'; if (b.city === 'FORT WORTH') return 'fw'; const z = b.z; if (!b.city && z && z.perm_share >= 0.6) return z.perm_city === 'Dallas' ? 'dal' : z.perm_city === 'Fort Worth' ? 'fw' : null; return null; };
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  async function fetchPermits(t) {
    const bs = [...t.ids].map(id => B.get(id)).filter(b => b && b.akey), out = [], errs = [];
    const dal = [...new Set(bs.filter(b => cityOf(b) === 'dal').map(b => b.street))].filter(s => /^[A-Z0-9 ]+$/.test(s));
    const fw = bs.filter(b => cityOf(b) === 'fw'), fwNames = [...new Set(fw.map(b => b.street))].filter(s => /^[A-Z0-9 ]+$/.test(s)), fwZips = [...new Set(fw.map(b => b.zip).filter(z => /^\d{5}$/.test(z)))];
    for (const names of chunks(dal, 18)) {
      const where = `(upper(permit_type) like '%MECHANICAL%' OR (upper(permit_type) like '%NEW CONSTRUCTION%' AND NOT upper(permit_type) like '%SIGN%')) AND (${names.map(n => `(' '||upper(street_address)||' ') like '% ${n} %'`).join(' OR ')})`;
      try { const j = await getJSON(EP.dallas + '?' + qs({ $select: 'permit_type,issued_date,street_address,zip_code,work_description', $where: where, $limit: 5000 }), { timeout: 30000 });
        (Array.isArray(j) ? j : []).forEach(r => { const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(String(r.issued_date || '').trim()); if (!m) return; const d = '20' + m[3] + '-' + m[1] + '-' + m[2], a = addrParts(r.street_address); if (!a.key) return;
          out.push({ key: a.key, d, y: fracYear(d), desc: r.work_description || '', type: r.permit_type || '', newc: /NEW CONSTRUCTION/i.test(r.permit_type || ''), src: 'City of Dallas' }); }); }
      catch (e) { errs.push('Dallas permits: ' + why(e)); }
    }
    if (fwNames.length && fwZips.length) for (const names of chunks(fwNames, 30)) {
      const where = `Permit_Type = 'Mechanical' AND Current_Status NOT IN ('Void', 'Withdrawn') AND Zip_Code IN (${fwZips.join(',')}) AND Street_Name IN (${names.map(n => `'${n}'`).join(',')})`;
      try { const j = await getJSON(EP.fw + '?' + qs({ where, outFields: 'Permit_SubType,File_Date,Addr_No,Direction,Street_Name,Street_Suffix,Zip_Code,B1_WORK_DESC', returnGeometry: 'false', f: 'json' }), { timeout: 30000 });
        (j.features || []).forEach(f => { const a = f.attributes || {}; if (!isN(a.File_Date) || !a.Addr_No) return; const d = ymd(a.File_Date), k = addrParts(`${a.Addr_No} ${a.Direction || ''} ${a.Street_Name || ''} ${a.Street_Suffix || ''}`); if (!k.key) return;
          const desc = a.B1_WORK_DESC && a.B1_WORK_DESC !== 'B1_WORK_DESC' ? a.B1_WORK_DESC : (a.Permit_SubType === 'Standalone' ? 'Mechanical permit (changeout or repair)' : 'Mechanical permit under a building permit');
          out.push({ key: k.key, d, y: fracYear(d), desc, type: 'Mechanical, ' + (a.Permit_SubType || ''), newc: false, src: 'City of Fort Worth' }); }); }
      catch (e) { errs.push('Fort Worth permits: ' + why(e)); }
    }
    return { list: out, errs, asked: dal.length + fwNames.length };
  }
  function joinPermits(t, res) {
    const by = {}; res.list.forEach(p => (by[p.key] = by[p.key] || []).push(p));
    t.ids.forEach(id => { const b = B.get(id); if (!b || !b.akey) return; const ps = by[b.akey]; if (!ps) return; const seen = new Set(b.permits.map(p => p.d + p.desc));
      ps.forEach(p => { if (!seen.has(p.d + p.desc)) { b.permits.push(p); seen.add(p.d + p.desc); } }); b.permits.sort((x, y) => y.y - x.y);
      const nc = b.permits.filter(p => p.newc).sort((x, y) => x.y - y.y)[0]; if (nc && !b.yb) { b.yb = Math.floor(nc.y); b.ybSrc = 'permit'; b.ybFromPermit = true; } });
  }
  /* streets near the tile from the Census TIGER file, for standing Street View on the road in front of a building */
  async function roadsFor(t) {
    if (t.roads) return t.roads; if (t.roadsP) return t.roadsP;
    const pad = 0.0012, box = { w: t.box.w - pad, e: t.box.e + pad, s: t.box.s - pad, n: t.box.n + pad };
    t.roadsP = Promise.all([8, 6].map(L => getJSON(EP.roads + L + '/query?' + qs({ geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,MTFCC', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'json' }), { timeout: 25000 }).catch(() => ({ features: [] }))))
      .then(js => { const rs = []; js.forEach(j => (j.features || []).forEach(f => { const nm = f.attributes && f.attributes.NAME && f.attributes.NAME !== 'Null' ? f.attributes.NAME : ''; ((f.geometry && f.geometry.paths) || []).forEach(p => rs.push({ name: nm, core: nm ? addrParts('1 ' + nm).street : '', line: p.map(([lo, la]) => [la, lo]) })); })); t.roads = rs; t.roadsP = null; return rs; });
    return t.roadsP;
  }
  function nearestOn(pt, line) {
    const k = Math.cos(rad(pt[0])); let best = null;
    for (let i = 0; i + 1 < line.length; i++) { const ax = (line[i][1] - pt[1]) * k, ay = line[i][0] - pt[0], bx = (line[i + 1][1] - pt[1]) * k, by = line[i + 1][0] - pt[0], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const u = L2 ? clamp(-(ax * dx + ay * dy) / L2, 0, 1) : 0, px = ax + u * dx, py = ay + u * dy, d = px * px + py * py; if (!best || d < best.d) best = { d, la: pt[0] + py, lo: pt[1] + px / k }; }
    return best ? { lat: best.la, lon: best.lo, m: Math.sqrt(best.d) * 111320 } : null;
  }
  const tileOf = (la, lo) => { const x = lon2x(lo, TILE_Z), y = lat2y(la, TILE_Z), k = x + '/' + y; let t = T.get(k); if (!t) { t = { k, x, y, box: tileBox(TILE_Z, x, y), ids: new Set(), st: 'idle', at: 0 }; T.set(k, t); } return t; };
  /* where to stand: the nearest point on the building's own street (its address names it), else on the nearest named street */
  async function aim(target) {
    const c = [target.lat, target.lon]; let roads = []; try { roads = await roadsFor(tileOf(target.lat, target.lon)); } catch (e) { roads = []; }
    let best = null;
    roads.forEach(r => { const p = nearestOn(c, r.line); if (!p) return; const named = !!(target.street && r.core && r.core === target.street); const sc = p.m - (named ? 45 : 0) + (r.name ? 0 : 30); if (!best || sc < best.sc) best = { sc, p, r, named }; });
    if (best && best.p.m < 170 && best.p.m > 1) return { lat: best.p.lat, lon: best.p.lon, heading: bearing([best.p.lat, best.p.lon], c), road: best.r.name, named: best.named, m: best.p.m };
    return { lat: target.lat, lon: target.lon, heading: 0, road: '', named: false, m: 0 };
  }
  const svURL = v => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat.toFixed(6)},${v.lon.toFixed(6)}` + (isN(v.heading) ? `&heading=${Math.round(v.heading)}&pitch=5&fov=80` : '');
  const satURL = (la, lo) => `https://www.google.com/maps/@?api=1&map_action=map&center=${la.toFixed(6)},${lo.toFixed(6)}&zoom=20&basemap=satellite`;
  const mlyURL = (la, lo) => `https://www.mapillary.com/app/?lat=${la.toFixed(6)}&lng=${lo.toFixed(6)}&z=18`;
  /* Mapillary: the street photos within about 80 m that look toward the building, nearest and newest first */
  async function mlyNear(target) {
    const la = target.lat, lo = target.lon, dLa = 85 / 111320, dLo = 85 / (111320 * Math.cos(rad(la)));
    const j = await getJSON(EP.mly + '?' + qs({ access_token: CFG.mlyToken, fields: 'id,captured_at,compass_angle,computed_compass_angle,computed_geometry,geometry,is_pano,thumb_1024_url,thumb_2048_url', bbox: [lo - dLo, la - dLa, lo + dLo, la + dLa].map(v => v.toFixed(6)).join(','), limit: 120 }), { timeout: 20000 });
    return (j.data || []).map(im => {
      const g = ((im.computed_geometry || im.geometry) || {}).coordinates; if (!g) return null;
      const p = [g[1], g[0]], m = meters(p, [la, lo]), brg = bearing(p, [la, lo]), cam = isN(im.computed_compass_angle) ? +im.computed_compass_angle : +im.compass_angle || 0, off = im.is_pano ? 0 : Math.abs(((brg - cam + 540) % 360) - 180);
      if (m < 5 || m > 95 || (!im.is_pano && off > 70)) return null;
      return { id: String(im.id), m, brg, cam, off, pano: !!im.is_pano, url: im.thumb_2048_url || im.thumb_1024_url, thumb: im.thumb_1024_url || im.thumb_2048_url, at: im.captured_at, rank: m / 30 + off / 35 + (Date.now() - (+im.captured_at || 0)) / (4 * 365.25 * 864e5) };
    }).filter(x => x && x.url).sort((a, b) => a.rank - b.rank).slice(0, 6);
  }

  /* ============================ the module ============================ */
  registerModule({
    key: KEY, num: NUM, title: 'Rooftop Scout', desc: 'The heatmaps on commercial satellite imagery, down to the building: rooftops, Street View from the road, and every building marked for likely repair, replacement or installation with its likely system',
    mount(root) {
      const self = this;
      const VIEWER = inViewer();
      const lineName = id => (SLM.LI[id] || {}).short || id;
      root.innerHTML = mastHTML({ eyebrow: `Module ${NUM} · Rooftop Scout · satellite, street and building level`, title: 'Rooftop Scout',
        dek: 'Fly over the atlas\'s heatmaps on commercial satellite imagery, drop to the street, and read every building in view: the heating and air conditioning system it most likely runs, and how likely it is to need a repair, a replacement or an installation. <b>Green</b> is likely, <b>orange</b> is maybe, <b>red</b> is not likely. Each building opens in Street View from the road in front of it, and anything you see on the roof or from the street can overrule the model.',
        meta: ['<b>Imagery</b> Esri World Imagery: Vantor satellite about 30 cm, 15 cm aerial at the closest zoom', '<b>Buildings</b> FEMA USA Structures', '<b>Age</b> county appraisal rolls and city permits', '<b>Model</b> the atlas\'s own life tables'],
        bar: 'Rooftop Scout', barsub: 'Live: needs the network · street level from zoom ' + CFG.minZoom,
        actions: [{ id: 'scCsv', label: '↓ Buildings CSV', title: 'The buildings in view, with system, need, evidence and your field checks' }, { id: 'scLinesGo', label: 'Service Lines ↗', title: 'Open the selected ZIP in the Service Lines ledger (module 12)' }, { id: 'scDeskGo', label: 'Campaign Desk ↗', title: 'Send the ZIPs in view to the Campaign Desk' }] }) +
        `<div class="wrap sc">
        ${VIEWER ? callout('', 'This view cannot reach the imagery', 'The Claude viewer blocks requests to outside servers, so the satellite tiles, the buildings and the street links cannot load here. Download this file and open it in Chrome, Edge, Safari or Firefox: everything below then runs live from your browser. The heatmap still draws.') : ''}
        ${callout('note', 'Read this first: what a colour on a roof means', 'Every building is <b>read by the atlas\'s models, not inspected</b>. Its type, size and height come from FEMA\'s national structure inventory; its age from the county appraisal roll where the statewide parcel file carries it (Tarrant, Collin, Denton and Wise) and otherwise from the ZIP\'s housing age; the last time its system was replaced from Dallas and Fort Worth mechanical permits. The atlas\'s RECS 2020 Texas life tables turn that into the chance of a <b>replacement within five years</b>, a <b>repair call within twelve months</b>, or an <b>installation</b> (an older, smaller home that may still cool with window units). <span class="sc-sw g" style="vertical-align:-1px"></span> <b>Green</b>: likely to need the work. <span class="sc-sw o" style="vertical-align:-1px"></span> <b>Orange</b>: maybe. <span class="sc-sw r" style="vertical-align:-1px"></span> <b>Red</b>: not likely (a dashed outline, so the three read apart without colour). Look at the roof and the street, then mark what you saw: your mark replaces the model\'s colour and travels with the CSV.')}
        <div class="kpis" id="scKpis"></div>
        <div class="controls">
          <div class="ctl" style="flex:1 1 300px"><label class="fl" for="scLayer">Heatmap layer</label><select id="scLayer">${layerOptions(Object.keys(LAYERS), CFG.heat)}</select></div>
          <div class="ctl"><label class="fl" for="scOp">Heatmap strength</label><input type="range" id="scOp" min="0" max="0.9" step="0.05" value="${CFG.opacity}"></div>
          <div class="ctl"><label class="fl" for="scImg">Imagery</label><select id="scImg"><option value="esri">Satellite</option><option value="esri-labels">Satellite with street names</option><option value="street">Street map</option></select></div>
          <div class="ctl" style="flex:1 1 260px"><label class="fl" for="scFind">Find an address, ZIP or city</label><form id="scFindF" autocomplete="off"><input type="search" id="scFind" placeholder="6846 Lorna Ln, Dallas · 75214 · Plano"></form></div>
        </div>
        <div class="sc-grid">
          <div class="card sc-mapcard"><div class="sc-modebar"><div class="seg" id="scMode" role="group" aria-label="What the card shows"><button type="button" data-v="map" aria-pressed="true">Satellite</button><button type="button" data-v="sv" aria-pressed="false">Street View</button></div><span class="sc-mnote" id="scModeNote">Pick a building, then Street View to stand in the street in front of it (or double click the building).</span></div>
            <div class="sc-map" id="scMap" role="application" aria-label="Satellite map of Dallas Fort Worth with the heatmap and buildings"></div>
            <div class="sc-svw" id="scSvw" hidden><div class="sc-svbar" id="scSvBar"></div><div class="sc-svj" id="scSvJ" hidden><div class="sc-svp" id="scSvP"></div><canvas class="sc-svc" id="scSvC" aria-hidden="true"></canvas></div><iframe class="sc-svf" id="scSvF" title="Google Street View" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="about:blank"></iframe></div>
            <div class="sc-bar"><span class="sc-st" id="scStatus"></span><span class="sc-chips" id="scChips"></span></div>
            <div class="sc-bar" style="border-top:0;padding-top:0"><span class="sc-note" id="scImgNote">The imagery's source and capture date show here at neighborhood zoom.</span></div>
            <div class="legend" id="scLeg"></div></div>
          <div class="stack sc-side">
            <div class="card"><div class="card-h sc-hd"><div><h3 id="scName">Pick a place</h3><p id="scSub">Click an area of the heatmap, or search an address</p></div><div id="scPill"></div></div><div class="card-b" id="scDetail"></div></div>
            <div class="card"><div class="card-h"><h3>From the road</h3><p id="scSvSub">Street View from the street in front of the building, in the map's place</p></div><div class="card-b" id="scSv"></div></div>
          </div>
        </div>
        <div class="card mt"><div class="card-h sc-tblh"><div><h3>Buildings in view</h3><p id="scTblSub">Zoom to street level to list them. Click a row to select it, a header to sort.</p></div>
          <div class="ctl"><label class="fl" for="scKind">Show</label><select id="scKind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}"${k === CFG.kind ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>
          <div class="tscroll" id="scTbl"></div></div>
        <div class="split">
          ${card('How a building is read', 'Seven steps, each named with its source and grade. Every number on a building card comes from them.', '<ol class="meth" id="scMeth"></ol>')}
          ${card('Settings and keys', 'Kept in this browser only. Nothing here is required: the imagery, buildings and Street View links work without any key.', '<div class="sc-form" id="scSet"></div>')}
        </div>
        <div class="split">
          ${card('Caveats: the fine print', 'What would change a colour on a roof.', '<div id="scCav"></div>')}
          ${card('What this cannot show', 'Gaps, and where the missing record lives.', '<div id="scGap"></div>')}
        </div>
        ${card('Source register', 'Every layer traced to the service it came from, with the grade the atlas applies.', '<div id="scSrc"></div>', 'mt')}
        <div class="foot">Rooftop Scout reads public records and models them. It does not inspect equipment, and a colour is a probability, not a finding about a household. The requests go from this browser to Esri, FEMA, the Texas Geographic Information Office, the Census Bureau, the City of Dallas, the City of Fort Worth, Google (for Street View, while it shows) and, with a token, Mapillary; no record of what you look at leaves this browser. Street View is Google's own player, loaded from google.com while it shows.</div>
        </div>`;

      $('#scImg', root).value = CFG.imagery;
      const host = $('#scMap', root);
      if (!LF) { host.innerHTML = '<div class="callout" style="margin:16px">The map library did not load, so the map cannot draw. Reload the page.</div>'; return; }

      /* ---------- the map ---------- */
      const map = LF.map(host, { minZoom: 8, maxZoom: 21, zoomSnap: 1, worldCopyJump: false, attributionControl: true, preferCanvas: false, maxBounds: [[30.6, -99.8], [34.9, -94.2]], maxBoundsViscosity: 0.6 });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      LF.control.scale({ imperial: true, metric: false, position: 'bottomleft' }).addTo(map);
      [['scHeat', 410], ['scCty', 415], ['scRef', 420], ['scBld', 430], ['scSel', 440]].forEach(([n, z]) => { const p = map.createPane(n); p.style.zIndex = z; if (n === 'scRef' || n === 'scCty') p.style.pointerEvents = 'none'; });
      const hint = LF.control({ position: 'topright' }); hint.onAdd = () => { const d = LF.DomUtil.create('div', 'sc-hint'); d.id = 'scHint'; return d; }; hint.addTo(map);
      const bR = LF.canvas({ pane: 'scBld', padding: 0.4, tolerance: 3 });
      const gB = LF.layerGroup().addTo(map), gSel = LF.layerGroup().addTo(map);
      const COL = { g: cssv('--sc-g') || '#1fbf4c', o: cssv('--sc-o') || '#ff9f1a', r: cssv('--sc-r') || '#f04438' };

      /* base imagery */
      let base = [], cm15 = null, tileErr = 0, tileOk = 0;
      const esriAttr = 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>. Imagery: Esri, Vantor, Earthstar Geographics and the GIS user community';
      function setBase() {
        base.forEach(l => map.removeLayer(l)); base = [];
        const root0 = CFG.arcgisKey ? EP.esriKey : EP.esri, tok = CFG.arcgisKey ? '?token=' + encodeURIComponent(CFG.arcgisKey) : '';
        const tl = (svc, o) => LF.tileLayer(root0 + svc + '/MapServer/tile/{z}/{y}/{x}' + tok, Object.assign({ maxZoom: 21, maxNativeZoom: 19, attribution: esriAttr, detectRetina: false }, o || {}));
        if (CFG.imagery === 'street') base.push(tl('World_Street_Map', { maxNativeZoom: 19, attribution: 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>. Map: Esri, HERE, Garmin, USGS, EPA, NPS' }));
        else {
          base.push(tl('World_Imagery', { maxNativeZoom: cm15 === false ? 19 : 20 }));
          if (CFG.imagery === 'esri-labels') { base.push(tl('Reference/World_Transportation', { pane: 'scRef', maxNativeZoom: 19, attribution: '' })); base.push(tl('Reference/World_Boundaries_and_Places', { pane: 'scRef', maxNativeZoom: 19, attribution: '' })); }
        }
        base.forEach((l, i) => { l.on('tileerror', () => { tileErr++; if (tileErr > 6 && !tileOk) status(); }); l.on('tileload', () => { tileOk++; }); l.addTo(map); if (i === 0) l.bringToBack(); });
      }
      setBase();

      /* ---------- the heatmap: the atlas's ZIP layer, fading as the roofs come up ---------- */
      /* the ZIP shapes take no pointer events of their own (the buildings' canvas lies over them at street level); the map's own
         pointer finds the ZIP under it, so the atlas's ZIP tooltip shows at every zoom below street level */
      const heat = LF.layerGroup().addTo(map), HP = {};
      ZP.forEach(p => { const poly = LF.polygon(p.rings, { pane: 'scHeat', weight: 0.8, color: '#ffffff', opacity: 0.6, fillOpacity: 0, smoothFactor: 0.6, interactive: false }); HP[p.zip] = poly; heat.addLayer(poly); });
      let tipZip = null;
      map.on('mousemove', e => { if (map.getZoom() >= 15 || hov) { if (tipZip) { tipZip = null; hideTip(); } return; } const zip = zipAt(e.latlng.lat, e.latlng.lng), z = zip && ZI[zip]; if (z && z.occ >= 200) { tipZip = zip; showTip(zipTip(z, CFG.heat).replace('Click for the full ledger', 'Click to fly to this ZIP'), e.originalEvent); } else if (tipZip) { tipZip = null; hideTip(); } });
      const cty = LF.layerGroup().addTo(map); CTY.forEach(c => cty.addLayer(LF.polygon(c.rings, { pane: 'scCty', weight: 1.6, color: '#ffffff', opacity: 0.8, fill: false, interactive: false, dashArray: '6 4' })));
      let selZip = null, scale = null;
      const fade = z => z <= 13 ? 1 : z === 14 ? 0.85 : z === 15 ? 0.6 : z === 16 ? 0.38 : z === 17 ? 0.18 : 0.08;
      function paintHeat() {
        const L = LAYERS[CFG.heat] || LAYERS.idx, sc = qScale(ZR.map(z => z[CFG.heat]), L.ramp, L.dir); scale = sc;
        const zm = map.getZoom(), fo = CFG.opacity * fade(zm);
        Object.entries(HP).forEach(([zip, poly]) => { const z = ZI[zip], c = z && z.occ >= 200 ? sc.f(z[CFG.heat]) : null, isSel = zip === selZip;
          poly.setStyle({ fillColor: c || '#000', fillOpacity: c ? fo : 0, color: isSel ? cssv('--accent') || '#0b6f6d' : '#ffffff', weight: isSel ? 3 : zm >= 15 ? 1.2 : 0.8, opacity: isSel ? 1 : zm >= 17 ? 0.35 : 0.6 }); if (isSel) poly.bringToFront(); });
        cty.eachLayer(l => l.setStyle({ opacity: zm >= 15 ? 0 : 0.8 }));
        const v = ZR.map(z => z[CFG.heat]).filter(isN);
        $('#scLeg', root).innerHTML = legendHTML({ title: 'Heatmap: ' + L.l, R: sc.R, lo: L.f(Math.min(...v)), hi: L.f(Math.max(...v)), note: `${G(L.g)} ${esc(L.note)} The heatmap fades as you zoom in so the roofs show; set its strength above.` }) +
          `<div><div class="lt">Buildings, from street level</div><div class="sc-chips"><span class="sc-chip" style="cursor:default"><span class="sc-sw g"></span>Likely needs work</span><span class="sc-chip" style="cursor:default"><span class="sc-sw o"></span>Maybe</span><span class="sc-chip" style="cursor:default"><span class="sc-sw r"></span>Not likely</span></div></div>`;
      }

      /* ---------- buildings on the map ---------- */
      var sel = null, hov = null;
      const shown = b => CFG.show[b.status] && (CFG.kind === 'all' || (PROF[b.cls] || PROF.unk).kind === CFG.kind);
      function bStyle(b) {
        /* the fill thins as the roofs come up, so the units on them stay visible at 15 cm; the outline carries the colour */
        const s = b.status, c = COL[s], isSel = sel && sel.type === 'b' && sel.id === b.id, zm = map.getZoom(), h = hov === b.id, fill = zm <= 17 ? 0.38 : zm === 18 ? 0.28 : zm === 19 ? 0.15 : 0.05;
        return { color: isSel ? '#ffffff' : c, weight: (isSel ? 3.5 : zm >= 19 ? 2.4 : 1.6) + (h ? 1.2 : 0) + (b.checked && !isSel ? 0.8 : 0), opacity: 1, fillColor: c, fillOpacity: isSel ? Math.min(0.12, fill) : s === 'r' ? fill * 0.4 : fill, dashArray: s === 'r' && !isSel ? (zm >= 19 ? '7 5' : '4 3') : null, renderer: bR, pane: 'scBld' };
      }
      function draw(b) {
        if (!b.lay) { b.lay = LF.polygon(b.rings, bStyle(b)); b.lay.on('click', e => { LF.DomEvent.stopPropagation(e); pick(b.id); });
          b.lay.on('dblclick', e => { LF.DomEvent.stop(e); hideTip(); pick(b.id); showSV({ lat: b.lat, lon: b.lon, street: b.street, b }); });
          b.lay.on('mouseover', e => { hov = b.id; b.lay.setStyle(bStyle(b)); showTip(bTip(b), e.originalEvent); }); b.lay.on('mousemove', e => showTip(bTip(b), e.originalEvent)); b.lay.on('mouseout', () => { hov = null; b.lay.setStyle(bStyle(b)); hideTip(); }); }
        else b.lay.setStyle(bStyle(b));
        const on = shown(b) && map.getZoom() >= CFG.minZoom - 1; if (on && !gB.hasLayer(b.lay)) gB.addLayer(b.lay); else if (!on && gB.hasLayer(b.lay)) gB.removeLayer(b.lay);
      }
      const bTip = b => `<div class="tt">${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</div><div class="ts">${esc((PROF[b.cls] || PROF.unk).l)}${b.zip ? ' · ' + esc(b.zip) : ''}</div>` + tipRow('Status', esc(STL[b.status]) + (b.checked ? ' (your check)' : '')) + tipRow('Score', String(b.sc.score)) + tipRow('Likely system', esc(b.sys.short)) + tipRow('Need', esc(needLabel(b).split(':')[0])) + tipRow('Year built', b.yb ? String(b.yb) : 'not on file') + (b.last ? tipRow('Last HVAC permit', esc(monthYear(b.last.d))) : '') + '<div class="tf">Click for the full reading · double click for Street View</div>';
      const restyleAll = () => B.forEach(b => { if (b.lay) draw(b); });

      /* ---------- loading the tiles in view ---------- */
      const Q = { run: 0, max: 3, list: [] };
      const pump = () => { while (Q.run < Q.max && Q.list.length) { const j = Q.list.shift(); Q.run++; Promise.resolve().then(j).catch(e => console.error('scout', e)).finally(() => { Q.run--; pump(); status(); }); } };
      let errors = [], gen = 0, pendingPick = null;
      function viewTiles() {
        const b = map.getBounds().pad(0.08), x0 = lon2x(b.getWest(), TILE_Z), x1 = lon2x(b.getEast(), TILE_Z), y0 = lat2y(b.getNorth(), TILE_Z), y1 = lat2y(b.getSouth(), TILE_Z), c = map.getCenter(), out = [];
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ x, y, d: Math.hypot(x + 0.5 - (c.lng + 180) / 360 * Math.pow(2, TILE_Z), y + 0.5 - lat2y(c.lat, TILE_Z)) });
        return out.sort((a, b) => a.d - b.d).slice(0, 20);
      }
      function inView(t) { const b = map.getBounds().pad(0.25); return map.getZoom() >= CFG.minZoom && !(t.box.e < b.getWest() || t.box.w > b.getEast() || t.box.n < b.getSouth() || t.box.s > b.getNorth()); }
      function load() {
        if (map.getZoom() < CFG.minZoom || VIEWER) return; gen++;
        viewTiles().forEach(({ x, y }) => { const k = x + '/' + y; let t = T.get(k); if (!t) { t = { k, x, y, box: tileBox(TILE_Z, x, y), ids: new Set(), st: 'idle', at: 0 }; T.set(k, t); }
          t.at = Date.now(); if (t.st === 'idle' || (t.st === 'err' && Date.now() - t.errAt > 15000)) { t.st = 'queued'; Q.list.push(() => loadTile(t)); } });
        pump(); status(); evict();
      }
      async function loadTile(t) {
        if (!inView(t) && !t.force) { t.st = 'idle'; return; }
        t.st = 'load'; status();
        let fc; try { fc = await fetchBuildings(t.box, 0); } catch (e) { t.st = 'err'; t.errAt = Date.now(); note('Buildings: ' + why(e)); return; }
        const bs = ingest(fc, t); bs.forEach(b => { read(b); draw(b); }); refreshSoon();
        const fips = [...new Set(bs.map(b => b.fips).filter(Boolean))];
        const wantParcels = fips.some(f => PCOV[f] !== 'no');
        if (wantParcels) { try { const ps = await fetchParcels(t); joinParcels(t, ps); fips.forEach(f => { if (PCOV[f]) return; const mine = bs.filter(b => b.fips === f && b.parcel); if (mine.length >= 8) PCOV[f] = mine.some(b => b.parcel.yb) ? 'yes' : 'no'; }); } catch (e) { note('Parcels: ' + why(e)); } }
        try { const pr = await fetchPermits(t); joinPermits(t, pr); pr.errs.forEach(note); t.permitsAsked = pr.asked; } catch (e) { note('Permits: ' + why(e)); }
        t.ids.forEach(id => { const b = B.get(id); if (b) { read(b); draw(b); } });
        t.st = 'ok'; t.force = false; refreshSoon(); tryPending(); if (svMode) drawSoon();
        if (sel && sel.type === 'b' && t.ids.has(sel.id)) detail();
      }
      function evict() {
        const ok = [...T.values()].filter(t => t.st === 'ok' || t.st === 'err').sort((a, b) => a.at - b.at); if (ok.length <= 70) return;
        ok.slice(0, ok.length - 70).forEach(t => { if (inView(t)) return; t.ids.forEach(id => { const b = B.get(id); if (!b) return; b.tiles.delete(t.k); if (!b.tiles.size && !(sel && sel.id === id)) { if (b.lay) gB.removeLayer(b.lay); B.delete(id); } }); t.ids.clear(); t.st = 'idle'; t.roads = null; });
      }
      function note(msg) { errors.push(msg); errors = errors.slice(-6); status(); }

      /* ---------- the status line, counts and table ---------- */
      /* the view the counts, the table and the CSV read: the map's, or while Street View hides the map, the last one it showed */
      let viewBounds = null; const curBounds = () => (svMode && viewBounds ? viewBounds : map.getBounds());
      const inViewB = () => { const bd = curBounds(); return [...B.values()].filter(b => bd.contains([b.lat, b.lon])); };
      function status() {
        const zm = map.getZoom(), busy = Q.run + Q.list.length, el2 = $('#scStatus', root), hintEl = document.getElementById('scHint'); if (!el2) return;
        const bs = zm >= CFG.minZoom ? inViewB() : [];
        let s = '';
        if (VIEWER) s = 'The viewer blocks outside requests: download the file to see imagery and buildings.';
        else if (tileErr > 6 && !tileOk) s = `<b>The imagery is not loading.</b> Check the connection${CFG.arcgisKey ? ' and the ArcGIS key in Settings' : ''}.`;
        else if (zm < CFG.minZoom) s = `Zoom ${zm}. Buildings appear from zoom ${CFG.minZoom} (street level). Click a ZIP to fly to it.`;
        else s = `${busy ? '<span class="sc-busy"></span>Reading buildings… ' : ''}<b>${N(bs.length)}</b> buildings in view${cm15 ? ' · 15 cm imagery here' : ''}${errors.length ? ` · <span title="${esc(errors.join('\n'))}">${N(errors.length)} source${errors.length === 1 ? '' : 's'} did not answer</span>` : ''}`;
        el2.innerHTML = s; el2.className = 'sc-st';
        if (hintEl) hintEl.textContent = !VIEWER && zm < CFG.minZoom && zm >= 12 ? `Zoom in ${CFG.minZoom - zm} more to see buildings` : '';
        const cnt = { g: 0, o: 0, r: 0 }; bs.forEach(b => cnt[b.status]++);
        $('#scChips', root).innerHTML = ['g', 'o', 'r'].map(k => `<button type="button" class="sc-chip" data-st="${k}" aria-pressed="${CFG.show[k]}" title="Show or hide ${STL[k].toLowerCase()} buildings"><span class="sc-sw ${k}"></span>${STS[k]} <b>${N(cnt[k])}</b></button>`).join('');
        $$('#scChips .sc-chip', root).forEach(c => c.onclick = () => { const k = c.dataset.st; CFG.show[k] = !CFG.show[k]; saveCfg(); restyleAll(); refreshSoon(); status(); });
      }
      let refreshT = null; const refreshSoon = () => { clearTimeout(refreshT); refreshT = setTimeout(refresh, 250); };
      function refresh() {
        status();
        const zm = map.getZoom(), all = zm >= CFG.minZoom ? inViewB() : [], bs = all.filter(shown);
        const cnt = { g: 0, o: 0, r: 0 }; all.forEach(b => cnt[b.status]++);
        const withYb = all.filter(b => b.ybSrc === 'parcel' || b.ybSrc === 'permit').length, withP = all.filter(b => b.permits.length).length, checks = all.filter(b => b.checked).length;
        $('#scKpis', root).innerHTML = kpiHTML([
          { l: 'Buildings in view', v: zm >= CFG.minZoom ? N(all.length) : '—', d: zm >= CFG.minZoom ? `${N(bs.length)} shown by the filters` : `zoom ${CFG.minZoom} or closer` },
          { l: 'Likely needs work', v: N(cnt.g), d: all.length ? `${pct(cnt.g / all.length)} of the buildings in view` : 'green on the map' },
          { l: 'Maybe', v: N(cnt.o), d: all.length ? `${pct(cnt.o / all.length)} of the buildings in view` : 'orange on the map' },
          { l: 'Not likely', v: N(cnt.r), d: all.length ? `${pct(cnt.r / all.length)} of the buildings in view` : 'red, dashed' },
          { l: 'Year built on file', v: all.length ? pct(withYb / all.length) : '—', d: 'appraisal roll or a new construction permit' },
          { l: 'HVAC permits found', v: N(withP), d: 'buildings with a Dallas or Fort Worth mechanical permit' },
          { l: 'Field checks', v: N(checks), d: `in view; ${N(Object.keys(CK).length)} saved in this browser` },
        ]);
        const tbl = $('#scTbl', root);
        if (!bs.length) { tbl.innerHTML = `<p class="sc-empty" style="padding:14px 16px">${zm < CFG.minZoom ? `Zoom to street level (${CFG.minZoom} or closer) to list the buildings in view.` : all.length ? 'The filters hide every building in view.' : 'No buildings read here yet.'}</p>`; $('#scTblSub', root).textContent = 'Zoom to street level to list them. Click a row to select it, a header to sort.'; return; }
        $('#scTblSub', root).textContent = `${N(bs.length)} in view${bs.length > 400 ? ', the 400 with the highest scores listed' : ''}. Click a row to select it, a header to sort.`;
        const rank = { g: 3, o: 2, r: 1 }, rows = bs.slice().sort((a, b) => b.sc.score - a.sc.score).slice(0, 400);
        dataTable(tbl, [
          { k: 'st', h: 'Status', l: 1, v: r => rank[r.status] * 1000 + r.sc.score, f: (v, r) => `<span class="sc-tdot ${r.status}"></span>${STS[r.status]}${r.checked ? ' ✓' : ''}` },
          { k: 'score', h: 'Score', v: r => r.sc.score, f: v => N(v), t: 'Chance of at least one paid job (percent): replacement within five years, a repair call within twelve months, an installation or hail work' },
          { k: 'addr', h: 'Address', l: 1, cls: 'sc-a', v: r => r.addr ? title(r.addr) : '', f: (v, r) => v ? esc(v) + (r.zip ? ` <span class="mini">${esc(r.zip)}</span>` : '') : '<span class="mini">no address on file</span>' },
          { k: 'use', h: 'Use', l: 1, v: r => (PROF[r.cls] || PROF.unk).l, f: v => esc(v) },
          { k: 'sys', h: 'Likely system', l: 1, cls: 'sc-w', v: r => r.sys.short, f: v => esc(v) },
          { k: 'need', h: 'Likely need', l: 1, cls: 'sc-w', v: r => needLabel(r), f: v => esc(v) },
          { k: 'yb', h: 'Built', v: r => r.yb || r.ybMid || null, f: (v, r) => r.yb ? String(r.yb) : r.ybMid ? `<span class="mini" title="Estimated from the ZIP's housing age">~${Math.round(r.ybMid / 10) * 10}s</span>` : '—' },
          { k: 'perm', h: 'Last HVAC permit', v: r => r.last ? r.last.y : null, f: (v, r) => r.last ? esc(monthYear(r.last.d)) : '—' },
        ], rows, { sortKey: 'score', sortDir: -1, id: r => r.id, onClick: id => pick(id, { pan: true }), rowClass: r => sel && sel.type === 'b' && sel.id === r.id ? 'sel' : '' });
      }

      /* ---------- picking a ZIP, a building or a point ---------- */
      function zoomZip(zip, o) {
        const p = ZPI[zip]; if (!p) return; selZip = zip; paintHeat();
        map.fitBounds(LF.latLngBounds(p.rings.flat()), { padding: [20, 20], maxZoom: (o && o.maxZoom) || 15 });
        if (!sel || sel.type !== 'b') { sel = { type: 'zip', zip }; detail(); }
      }
      function pick(id, o) {
        const b = B.get(id); if (!b) return; const prev = sel && sel.type === 'b' ? B.get(sel.id) : null;
        sel = { type: 'b', id }; if (prev && prev.lay) prev.lay.setStyle(bStyle(prev)); if (b.lay) { b.lay.setStyle(bStyle(b)); b.lay.bringToFront(); }
        if (b.zip && b.zip !== selZip) { selZip = b.zip; paintHeat(); }
        if (o && o.pan && !svMode) map.panTo([b.lat, b.lon], { animate: true });
        const t = { lat: b.lat, lon: b.lon, street: b.street, b };
        detail(); street(t); if (svMode) { if (o && o.noSV) { svTarget = t; renderSvBar(); drawSoon(); } else showSV(t); } refreshSoon();
      }
      function pickPoint(la, lo) {
        const prev = sel && sel.type === 'b' ? B.get(sel.id) : null; sel = { type: 'pt', lat: la, lon: lo }; if (prev && prev.lay) prev.lay.setStyle(bStyle(prev));
        const t = { lat: la, lon: lo, street: '', b: null };
        detail(); street(t); if (svMode) showSV(t); refreshSoon();
      }
      function tryPending() {
        if (!pendingPick) return; const { lat, lon } = pendingPick; let best = null, bd = 1e9;
        B.forEach(b => { if (inBox(lat, lon, b.bb) && inRings(lat, lon, b.rings)) { best = b; bd = 0; } else if (bd > 0) { const d = meters([lat, lon], [b.lat, b.lon]); if (d < bd) { bd = d; best = b; } } });
        const t = T.get(lon2x(lon, TILE_Z) + '/' + lat2y(lat, TILE_Z));
        if (best && bd < 35) { pendingPick = null; pick(best.id); } else if (t && (t.st === 'ok' || t.st === 'err')) { pendingPick = null; pickPoint(lat, lon); }
      }
      map.on('click', e => {
        const { lat, lng } = e.latlng; hideTip();
        if (map.getZoom() < 15) { const z = zipAt(lat, lng); if (z) zoomZip(z); return; }
        pickPoint(lat, lng);
      });

      /* ---------- the card for what is picked ---------- */
      const bar = (l, v, t) => `<div class="sc-pb" title="${esc(t || '')}"><span>${l}</span><i><u style="width:${clamp(v * 100, 0, 100).toFixed(0)}%"></u></i><b>${pct(v)}</b></div>`;
      function detail() {
        const nm = $('#scName', root), sb = $('#scSub', root), pl = $('#scPill', root), dt = $('#scDetail', root);
        if (!sel) { nm.textContent = 'Pick a place'; sb.textContent = 'Click an area of the heatmap, or search an address'; pl.innerHTML = ''; dt.innerHTML = `<p class="sc-empty">Start on the heatmap: the darker ZIPs carry the most thermal debt on the layer you choose. Click one to fly in; from zoom ${CFG.minZoom} every building in view is read and coloured. Or type an address above to go straight to a roof.</p>${zipList()}`; wireZipList(); return; }
        if (sel.type === 'zip') {
          const z = ZI[sel.zip]; nm.textContent = z ? `${z.zip} · ${z.city}` : sel.zip; sb.textContent = z ? `${z.cty} County · ${N(z.occ)} households · median year built ${D(z.medyr, 0)}` : ''; pl.innerHTML = z && isN(z.idx) ? `<span class="pill">Index ${D(z.idx, 0)}</span>` : '';
          dt.innerHTML = z ? `<div class="rowl"><span>Thermal Debt Index (percentile)</span><b>${D(z.idx, 0)}</b></div><div class="rowl"><span>Central systems 15 years or older</span><b>${P(z.ge15_sh)}</b></div><div class="rowl"><span>R22 era systems still running</span><b>${P(z.r22_sh)}</b></div><div class="rowl"><span>Original builder systems aged 10 to 25</span><b>${P(z.origwin_sh)}</b></div><div class="rowl"><span>Homes heated with gas</span><b>${P(z.gas_sh, 0)}</b></div><div class="rowl"><span>Heat pump share (model)</span><b>${P(z.hp_sh, 0)}</b></div><div class="rowl"><span>Large hail reports within 8 km since 2023</span><b>${N(z.hail_recent)}</b></div><div class="rowl"><span>Replacements expected in 2026</span><b>${N(z.rep)}</b></div>
            <p class="mini" style="margin-top:10px">Zoom to street level (${CFG.minZoom}) inside the ZIP and every building is read with these figures as its starting point.</p><div class="sc-acts"><button class="btn sm" id="scZin">Zoom to street level</button><button class="btn sm sec" data-go="index">Thermal Debt Index ↗</button></div>` : '';
          const zin = $('#scZin', root); if (zin) zin.onclick = () => { const p = ZPI[sel.zip]; const c = LF.latLngBounds(p.rings.flat()).getCenter(); map.setView(c, CFG.minZoom); };
          return;
        }
        if (sel.type === 'pt') { nm.textContent = 'A point on the map'; sb.textContent = `${sel.lat.toFixed(5)}, ${sel.lon.toFixed(5)}${zipAt(sel.lat, sel.lon) ? ' · ZIP ' + zipAt(sel.lat, sel.lon) : ''}`; pl.innerHTML = ''; dt.innerHTML = `<p class="sc-empty">No building is selected. Click a coloured roof to read it${map.getZoom() < CFG.minZoom ? `, after zooming to ${CFG.minZoom} or closer` : ''}. Street View for this point is beside.</p>`; return; }
        const b = B.get(sel.id); if (!b) return; const s = b.sc, st = b.state, sys = b.sys, ck = CK[b.id] || {}, z = b.z;
        nm.textContent = b.addr ? title(b.addr) : 'Building, no address on file';
        sb.textContent = [b.city ? title(b.city) : (z ? z.city : ''), b.zip, (PROF[b.cls] || PROF.unk).l, b.sqft ? N(Math.round(b.sqft / 10) * 10) + ' sq ft footprint' : '', b.h ? D(b.h, 1) + ' m tall' : ''].filter(Boolean).join(' · ');
        pl.innerHTML = `<div class="sc-score">${N(s.score)}<small>score</small></div><button type="button" class="btn sm sc-svq" id="scSvQ" title="Stand in the street in front of this building">Street View</button>`;
        $('#scSvQ', pl).onclick = () => { showSV({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        const ybTxt = b.ybSrc === 'parcel' ? `<b>Built ${b.yb}</b>, from the ${esc(title(b.parcel && b.parcel.src || 'county appraisal district'))} roll in the TxGIO statewide parcel file${b.parcel && b.parcel.tax ? ' (' + esc(b.parcel.tax) + ')' : ''} ${G('A')}`
          : b.ybSrc === 'permit' ? `<b>Built about ${b.yb}</b>, from a new construction permit (${esc(b.permits.find(p => p.newc) ? b.permits.find(p => p.newc).src : 'city')}) ${G('A')}`
          : `<b>Year built not on file</b>${b.fips && PCOV[b.fips] === 'no' ? ` (the statewide parcel file carries none for ${esc(CNAME(b.fips))} County)` : ''}. Most likely ${b.prior ? b.prior.map((w, i) => [w, i]).sort((x, y) => y[0] - x[0]).slice(0, 2).map(([w, i]) => `${BIN_L[i]} (${pct(w)})`).join(' or ') : 'unknown'}, from the ZIP's housing age${b.cls === 'sf' ? ' and the footprint' : ''} ${G('C')}`;
        const pm = b.permits.filter(p => !p.newc).slice(0, 4);
        const permTxt = pm.length ? pm.map(p => `<b>HVAC permit ${esc(monthYear(p.d))}</b>: ${esc(String(p.desc).slice(0, 90) || p.type)} (${esc(p.src)}) ${G('A')}`).join('</li><li>') + (b.lastW != null ? `</li><li>The model takes the newest permit as a system ${b.lastW >= 0.85 ? 'replacement' : b.lastW >= 0.6 ? 'replacement, most likely' : 'repair or partial job'} and restarts the clock there (weight ${pct(b.lastW)}).` : '')
          : cityOf(b) ? `<b>No mechanical permit on file</b> at this address (${cityOf(b) === 'dal' ? 'City of Dallas, 2018 on' : 'City of Fort Worth, 2001 on'}). Only about one replacement in five is permitted (module 04's capture rate), so this is weak evidence ${G('B')}` : 'No city permit file covers this address in the atlas (Dallas and Fort Worth only).';
        const mix = sys.mix ? `<div class="sc-sub">Odds by type: ${sys.mix.map(([l, p]) => `${esc(l)} ${pct(p)}`).join(' · ')} ${G('B')}</div>` : '';
        const ctx = z ? `<b>ZIP ${esc(z.zip)}</b>: Thermal Debt Index ${D(z.idx, 0)}, ${P(z.ge15_sh, 0)} of systems 15 or older, ${P(z.gas_sh, 0)} heated with gas, ${plural(+z.hail_recent || 0, 'large hail report')} within 8 km since 2023 ${G('B')}` : '';
        dt.innerHTML = `<div class="sc-sec"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="sc-pill ${b.status}">${STL[b.status]}</span>${b.checked && ck.s ? '<span class="pill">your field check</span>' : ''}</div><div class="sc-sys" style="margin-top:8px">${esc(needLabel(b))}</div></div>
          <div class="sc-sec"><p class="sc-k">Likely system</p><div class="sc-sys">${esc(sys.name)}</div>${sys.size ? `<div class="sc-sub">${esc(sys.size)}</div>` : ''}${mix}<div class="sc-sub"><b>Controls and environment:</b> ${esc(sys.controls)}</div></div>
          <div class="sc-sec"><p class="sc-k">Chance of the work ${G('B')}</p><div class="sc-bars">${bar('Replacement within 5 years', s.P5, 'From the life tables, given the age evidence below' + (sys.units > 1 ? '; any of ' + sys.units + ' units, damped by the square root' : ''))}${bar('Repair call within 12 months', s.REP, 'Module 05 call rates by system age')}${bar('Installation (no central air)', s.inst, 'Older, smaller homes that may still cool with room units')}${s.hail ? bar('Hail work', s.hail, 'Large hail within 8 km since 2023') : ''}</div>
            <div class="sc-sub" style="margin-top:6px">${sys.life === 'none' ? '' : `${b.last && b.lastW >= 0.6 ? `Still the system from the ${Math.floor(b.last.y)} permit` : 'Still the original system'}: ${pct(st.pOrig)} · 15 years or older: ${pct(st.pOld)} · R22 era: ${pct(st.pR22)} · average age ${D(st.age, 0)} years.`}${sys.factor < 1 ? ` Weighted by ${pct(sys.factor)}, the share of a building like this a contractor would expect to condition.` : ''}</div>
            <div class="sc-lines">${b.lines.map(id => `<button type="button" class="chip" data-line="${esc(id)}" title="Open ${esc(lineName(id))} in Service Lines for ZIP ${esc(b.zip || '')}">${esc(lineName(id))}</button>`).join('')}</div></div>
          <div class="sc-sec"><p class="sc-k">Evidence</p><ul class="sc-ev"><li>${ybTxt}</li><li>${permTxt}</li>${ctx ? `<li>${ctx}</li>` : ''}<li><b>${esc((PROF[b.cls] || PROF.unk).l)}</b>: FEMA USA Structures (${esc(b.occ || 'unclassified')}${b.prim && b.prim !== b.occ ? ', ' + esc(b.prim) : ''})${b.acc ? '; read as an accessory building because a larger structure shares its address' : ''} ${G('C')}</li></ul></div>
          <div class="sc-sec sc-check"><p class="sc-k">Field check: what you saw on the roof or from the street</p>
            <div class="seg" id="scCkS" role="group" aria-label="Your status">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely'], ['', 'Model']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${(ck.s || '') === v}">${l}</button>`).join('')}</div>
            <div class="sc-cues">${CUES.map(([k, l]) => `<label class="chk"><input type="checkbox" data-cue="${k}"${(ck.cues || []).includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>
            <input type="text" id="scCkN" maxlength="240" placeholder="A note (kept in this browser)" value="${esc(ck.note || '')}">
            ${ck.at ? `<p class="sc-note">Checked ${esc(new Date(ck.at).toLocaleString())}</p>` : ''}</div>
          <div class="sc-acts"><button class="btn sm" id="scSv1">Street View</button><button class="btn sm sec" id="scCopy">Copy address</button><button class="btn sm sec" data-go-lines="1">Service Lines ↗</button><button class="btn sm sec" id="scDesk1">Campaign Desk ↗</button></div>`;
        $('#scSv1', dt).onclick = () => { showSV({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        $$('[data-line]', dt).forEach(c => c.onclick = () => goModule('lines', { line: c.dataset.line, zip: b.zip }));
        const lg = $('[data-go-lines]', dt); if (lg) lg.onclick = () => goModule('lines', { zip: b.zip, line: b.lines[0] || 'replace' });
        $('#scDesk1', dt).onclick = () => goModule('desk', { zips: [b.zip].filter(Boolean) });
        $('#scCopy', dt).onclick = () => copyText([b.addr ? title(b.addr) : `${b.lat.toFixed(6)}, ${b.lon.toFixed(6)}`, b.city ? title(b.city) : '', b.zip].filter(Boolean).join(', '));
        $$('#scCkS button', dt).forEach(btn => btn.onclick = () => { const v = btn.dataset.v; setCheck(b.id, { s: v || undefined }); if (!v && CK[b.id]) { delete CK[b.id].s; store.set(CHECKS, CK); } const c2 = CK[b.id]; if (c2 && !c2.s && !(c2.cues || []).length && !c2.note) { delete CK[b.id]; store.set(CHECKS, CK); } statusOf(b); draw(b); detail(); refreshSoon(); });
        $$('[data-cue]', dt).forEach(cb => cb.onchange = () => { const cues = $$('[data-cue]', dt).filter(x => x.checked).map(x => x.dataset.cue); const cur = CK[b.id] || {};
          let s2 = cur.s; if (!s2 && cb.checked) { const hint2 = (CUES.find(c => c[0] === cb.dataset.cue) || [])[2]; if (hint2) s2 = hint2; }
          setCheck(b.id, { cues, s: s2 }); statusOf(b); draw(b); detail(); refreshSoon(); });
        $('#scCkN', dt).onchange = e => { setCheck(b.id, { note: e.target.value.trim().slice(0, 240) }); statusOf(b); draw(b); refreshSoon(); };
      }
      function zipList() {
        const top = ZR.slice().sort((a, b) => b.idx - a.idx).slice(0, 8);
        return `<p class="sc-k" style="margin-top:12px">Most thermal debt</p>${top.map(z => `<div class="rowl"><span><button type="button" class="lnk" data-zip="${esc(z.zip)}">${esc(z.zip)} · ${esc(z.city)}</button></span><b>${D(z.idx, 0)}</b></div>`).join('')}`;
      }
      function wireZipList() { $$('[data-zip]', $('#scDetail', root)).forEach(x => x.onclick = () => zoomZip(x.dataset.zip)); }

      /* ---------- from the road ---------- */
      let cam = null, sight = null, svTok = 0, photos = [], photoI = 0;
      async function street(target) {
        const my = ++svTok, box = $('#scSv', root);
        box.innerHTML = '<p class="sc-empty"><span class="sc-busy"></span>Finding the street in front…</p>';
        let v; try { v = await aim(target); } catch (e) { v = { lat: target.lat, lon: target.lon, heading: 0, road: '', m: 0 }; }
        if (my !== svTok) return;
        gSel.clearLayers();
        if (v.m > 0) { sight = LF.polyline([[v.lat, v.lon], [target.lat, target.lon]], { pane: 'scSel', color: '#ffffff', weight: 2, dashArray: '5 5', opacity: 0.95, interactive: false }).addTo(gSel); }
        cam = LF.marker([v.lat, v.lon], { pane: 'scSel', interactive: false, keyboard: false, icon: LF.divIcon({ className: '', html: '<div class="sc-cam" title="Where Street View stands"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(gSel);
        const where = v.road ? `standing on ${esc(v.road)}, looking ${compass(v.heading)}${target.b ? ' at the building' : ''}` : 'at the street nearest this point';
        box.innerHTML = `<div class="sc-sv"><button type="button" class="btn sc-svgo" id="scSvShow">Show Street View</button>
          <p class="sc-note">Live Google Street View in the map's place, ${where}: drag to look around, click the arrows in the picture to walk the street, and step from building to building. The satellite map comes back with one click. <a href="${esc(svURL(v))}" id="scSvGo" target="scout-streetview" referrerpolicy="no-referrer">Open it in Google Maps instead ↗</a></p>
          <div id="scMly"></div>
          <div class="sc-acts" style="margin-top:2px"><a class="btn sm sec" href="${esc(satURL(target.lat, target.lon))}" target="scout-streetview" referrerpolicy="no-referrer">Google satellite ↗</a><a class="btn sm sec" href="${esc(mlyURL(target.lat, target.lon))}" target="_blank" rel="noopener noreferrer">Mapillary ↗</a></div></div>`;
        $('#scSvShow', root).onclick = () => { showSV(target); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        $('#scSvSub', root).textContent = target.b ? 'Street View aimed at this building from its street' : 'Street View at this point';
        const mb = $('#scMly', root);
        if (!CFG.mlyToken) { mb.innerHTML = `<p class="sc-note">Street photos can show here too: save a free Mapillary token in <button type="button" class="lnk" id="scToSet">Settings and keys</button>.</p>`; $('#scToSet', root).onclick = () => { $('#scSet', root).scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = $('#scMlyK', root); if (i) i.focus(); }; return; }
        mb.innerHTML = '<p class="sc-note"><span class="sc-busy"></span>Looking for Mapillary street photos…</p>';
        try { photos = await mlyNear(target); } catch (e) { if (my === svTok) mb.innerHTML = `<p class="sc-note">Mapillary did not answer: ${esc(why(e))}.</p>`; return; }
        if (my !== svTok) return; photoI = 0;
        if (!photos.length) { mb.innerHTML = '<p class="sc-note">No Mapillary photo within about 90 m faces this spot. Street View above has the street.</p>'; return; }
        showPhoto(target);
      }
      function showPhoto(target) {
        const mb = $('#scMly', root), ph = photos[photoI]; if (!mb || !ph) return;
        let bg = `background-image:url('${String(ph.url).replace(/['"\\()]/g, encodeURIComponent)}')`;
        /* a 360° photo is equirectangular with the camera's heading at its centre: shown at four times the frame's width (a 90°
           view) and slid so the bearing to the building sits in the middle */
        if (ph.pano) { const f = ((((ph.brg - (ph.cam - 180)) % 360) + 360) % 360) / 360; bg += `;background-position:${(((4 * f - 0.5) / 3) * 100).toFixed(2)}% 50%`; }
        mb.innerHTML = `<div class="sc-photo${ph.pano ? ' pano' : ''}" style="${esc(bg)}" role="img" aria-label="Street photo from Mapillary, ${esc(D(ph.m, 0))} m away"><div class="cap"><span>${esc(monthYear(ymd(ph.at)))} · ${D(ph.m, 0)} m ${esc(compass((ph.brg + 180) % 360))} of the ${target.b ? 'building' : 'point'}${ph.pano ? ' · 360°, turned to face it' : ''}</span><a href="https://www.mapillary.com/app/?pKey=${encodeURIComponent(ph.id)}&focus=photo" target="_blank" rel="noopener noreferrer">Mapillary ↗</a></div></div>
          ${photos.length > 1 ? `<div class="sc-thumbs">${photos.map((p, i) => `<button type="button" data-i="${i}" aria-pressed="${i === photoI}" aria-label="Photo ${i + 1}, ${esc(monthYear(ymd(p.at)))}, ${D(p.m, 0)} m" title="${esc(monthYear(ymd(p.at)))}, ${D(p.m, 0)} m" style="${esc(`background-image:url('${String(p.thumb).replace(/['"\\()]/g, encodeURIComponent)}')`)}"></button>`).join('')}</div>` : ''}
          <p class="sc-note">Photos © Mapillary contributors, CC BY-SA 4.0.</p>`;
        $$('.sc-thumbs button', mb).forEach(x => x.onclick = () => { photoI = +x.dataset.i; showPhoto(target); });
      }

      /* ---------- Street View inside the dashboard ---------- */
      /* Live Google Street View in the map card's own place, aimed from the street at the building. While it shows, the
         satellite map is hidden: Google's Maps Platform terms (3.2.3(e)) keep Street View imagery and a non-Google map off the
         same screen, so the card switches between the two instead of showing both.
         Two players. With a Google Maps key saved (Maps JavaScript API), the panorama is Google's StreetViewPanorama in a box
         of this page. It reports where its camera stands and looks (position, heading, pitch, zoom) at every move, so every
         building within about 110 m is raised from its FEMA footprint to its height, drawn in perspective from that camera, and
         given a glow in its colour; the glows follow as the view turns, zooms and walks. Without a key it is Google's standard
         embedded player, which is sealed (it tells the page nothing about where it looks): no glow could be placed on it
         correctly, so none is drawn and the bar offers the key instead. */
      const svw = $('#scSvw', root), svf = $('#scSvF', root), svBar = $('#scSvBar', root), mapCard = $('.sc-mapcard', root), svj = $('#scSvJ', root), svp = $('#scSvP', root), svc = $('#scSvC', root);
      var svMode = false; let svFull = false, svTarget = null, svView = null, svHead = 0, svPitch = 0, svList = [], svTok2 = 0;
      const GM = { p: null, lib: null, pano: null, svc: null, failed: '', cam: null, date: '', hits: [], hov: null, n: 0, live: false };
      const glowOn = () => !!CFG.gKey && !GM.failed;
      const svSrc = (v, head, pitch) => `https://maps.google.com/maps?layer=c&cbll=${v.lat.toFixed(6)},${v.lon.toFixed(6)}&cbp=11,${Math.round(((head % 360) + 360) % 360)},0,0,${Math.round(-pitch)}&output=svembed&hl=en`;
      const pitchFor = b => !b ? 0 : b.sys.life === 'plant' ? 18 : b.sys.life === 'rtu' ? 12 : b.sys.life === 'ptac' ? 8 : 2;   /* tilt up for roofs that carry the units */

      /* the Maps JavaScript API, loaded once, only when a key is saved and Street View is asked for */
      function loadGoogle() {
        if (GM.lib) return Promise.resolve(GM.lib);
        if (GM.p) return GM.p;
        GM.p = new Promise((ok, no) => {
          const cb = '__scoutGoogle' + Math.random().toString(36).slice(2), t = setTimeout(() => no(new Error('the Google Maps script did not load within 25 seconds')), 25000);
          window[cb] = async () => {
            clearTimeout(t); try { delete window[cb]; } catch (e) { window[cb] = undefined; }
            const g = window.google && window.google.maps; if (!g) { no(new Error('the Google Maps script loaded without google.maps')); return; }
            let lib = g; if (typeof g.importLibrary === 'function') { try { lib = Object.assign({}, g, await g.importLibrary('streetView')); } catch (e) { lib = g; } }
            if (!lib.StreetViewPanorama || !lib.StreetViewService) { no(new Error('this version of the Maps JavaScript API has no Street View classes')); return; }
            GM.lib = lib; ok(lib);
          };
          const before = window.gm_authFailure;   /* Google calls this when it refuses the key, after the script has loaded */
          window.gm_authFailure = () => { GM.failed = 'Google refused the key. Turn on the Maps JavaScript API for it, and do not limit it to web addresses (a file opened from this computer sends none).'; toast('Google refused the Maps key: Street View is back on the plain player'); if (svMode && svTarget) showSV(svTarget); if (typeof before === 'function') { try { before(); } catch (e) { /* theirs */ } } };
          const s = document.createElement('script'); s.async = true; s.src = 'https://maps.googleapis.com/maps/api/js?' + qs({ key: CFG.gKey, v: 'weekly', callback: cb });
          s.onerror = () => { clearTimeout(t); no(new Error('the Google Maps script could not be reached')); };
          document.head.appendChild(s);
        });
        GM.p.catch(e => { GM.failed = 'The Maps JavaScript API did not load: ' + why(e) + '.'; GM.p = null; });
        return GM.p;
      }
      async function ensurePano() {
        const lib = await loadGoogle();
        if (!GM.pano) {
          GM.pano = new lib.StreetViewPanorama(svp, { visible: true, addressControl: true, linksControl: true, panControl: true, zoomControl: true, clickToGo: false, fullscreenControl: false, motionTracking: false, motionTrackingControl: false, enableCloseButton: false, showRoadLabels: true });
          GM.svc = new lib.StreetViewService();
          ['pov_changed', 'zoom_changed', 'position_changed', 'pano_changed'].forEach(ev => GM.pano.addListener(ev, () => onPano(ev)));
        }
        return GM.pano;
      }
      /* the panorama nearest the point on the street, widening the search when the street has none close by */
      async function findPano(v) {
        const L = GM.lib, src = (L.StreetViewSource && (L.StreetViewSource.OUTDOOR || L.StreetViewSource.GOOGLE)) || 'outdoor', pref = (L.StreetViewPreference && L.StreetViewPreference.NEAREST) || 'nearest';
        let last = null;
        for (const radius of [35, 80, 200]) {
          try { const r = await GM.svc.getPanorama({ location: { lat: v.lat, lng: v.lon }, radius, sources: [src], preference: pref }); const d = r && (r.data || r); if (d && d.location && d.location.pano) return d; }
          catch (e) { last = e; }
        }
        throw last || new Error('no Street View near this street');
      }
      const latLngOf = ll => ll ? [typeof ll.lat === 'function' ? ll.lat() : +ll.lat, typeof ll.lng === 'function' ? ll.lng() : +ll.lng] : null;
      const dateOf = s => { const m = /^(\d{4})-(\d\d)/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 15)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''; };
      const metaDate = debounce(async () => { if (!GM.pano || !GM.svc) return; const id = GM.pano.getPano && GM.pano.getPano(); if (!id) return; try { const r = await GM.svc.getPanorama({ pano: id }); const d = r && (r.data || r); if (d && GM.pano.getPano() === id) { GM.date = d.imageDate || ''; renderSvBar(); } } catch (e) { /* the date is a courtesy */ } }, 700);
      function onPano(ev) {
        if (!GM.live) return;
        if (ev === 'position_changed') { const c = latLngOf(GM.pano.getPosition()); if (c) { GM.cam = c; ensureAround(c[0], c[1]); } }
        if (ev === 'pano_changed') metaDate();
        if (ev === 'pov_changed' || ev === 'position_changed') renderWhere();
        drawSoon();
      }
      /* buildings around the camera: the tiles under it and around it, even while the map is hidden */
      function ensureAround(la, lo) {
        const d = 0.0016, ks = new Set();
        [[0, 0], [d, 0], [-d, 0], [0, d * 1.2], [0, -d * 1.2]].forEach(([a, b]) => ks.add(lon2x(lo + b, TILE_Z) + '/' + lat2y(la + a, TILE_Z)));
        ks.forEach(k => { let t = T.get(k); if (!t) { const [x, y] = k.split('/').map(Number); t = { k, x, y, box: tileBox(TILE_Z, x, y), ids: new Set(), st: 'idle', at: 0 }; T.set(k, t); }
          t.at = Date.now(); if (t.st === 'idle' || (t.st === 'err' && Date.now() - (t.errAt || 0) > 15000)) { t.st = 'queued'; t.force = true; Q.list.unshift(() => loadTile(t)); } });
        pump();
      }

      /* ---------- the glows: each building's footprint raised to its height and drawn from the panorama's camera ---------- */
      const CAMH = 2.5, NEAR = 0.8, MAXD = 110;    /* Google's camera rides about 2.5 m up; nothing nearer than 0.8 m is drawn */
      const mLat = la => 111132.92 - 559.82 * Math.cos(2 * rad(la)) + 1.175 * Math.cos(4 * rad(la)), mLon = la => 111412.84 * Math.cos(rad(la)) - 93.5 * Math.cos(3 * rad(la));
      const fovOf = z => 180 / Math.pow(2, isN(z) ? +z : 1);   /* Google: a zoom of 0 is a 180° field of view, halved at each level */
      const hOf = b => (b.h > 2.2 ? b.h : b.cls === 'shed' ? 3 : b.cls === 'garage' ? 4 : b.cls === 'sf' || b.cls === 'mh' ? (storiesRes(b.h) > 1 ? 8.5 : 5.5) : b.cls === 'mf' ? 9.5 : 6.5);
      function camera(W, H) {
        if (!GM.pano || !GM.cam) return null;
        const pov = GM.pano.getPov() || {}, la = GM.cam[0], lo = GM.cam[1], ky = mLat(la), kx = mLon(la);
        const yaw = rad(+pov.heading || 0), pit = rad(+pov.pitch || 0), sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pit), cp = Math.cos(pit), F = (W / 2) / Math.tan(rad(clamp(fovOf(GM.pano.getZoom()), 4, 170)) / 2);
        /* east, north, up from the camera into its own right, up and forward axes, then onto the picture plane */
        return { la, lo, F, cam: (pla, plo, up) => { const e = (plo - lo) * kx, n = (pla - la) * ky, u = up - CAMH; return [e * cy - n * sy, -e * sy * sp - n * cy * sp + u * cp, e * sy * cp + n * cy * cp + u * sp]; }, scr: c => [W / 2 + F * c[0] / c[2], H / 2 - F * c[1] / c[2]] };
      }
      function hull(P) {
        if (P.length < 3) return P; const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
        for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
        for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
        lo.pop(); up.pop(); return lo.concat(up);
      }
      /* the outline a building makes in the picture: every corner of the raised footprint in front of the camera, and where an
         edge crosses the near plane, projected; their hull is the glow */
      function outline(b, C) {
        const top = hOf(b), pts = [], add = (a, c) => { const ai = a[2] >= NEAR, ci = c[2] >= NEAR; if (ai) pts.push(C.scr(a)); if (ai !== ci) { const t = (NEAR - a[2]) / (c[2] - a[2]); pts.push(C.scr([a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1]), NEAR])); } };
        b.rings.forEach(r => { const n = r.length - (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? 1 : 0); if (n < 3) return;
          const lo = [], hi = []; for (let i = 0; i < n; i++) { lo.push(C.cam(r[i][0], r[i][1], 0)); hi.push(C.cam(r[i][0], r[i][1], top)); }
          for (let i = 0; i < n; i++) { const j = (i + 1) % n; add(lo[i], lo[j]); add(hi[i], hi[j]); add(lo[i], hi[i]); } });
        return pts.length >= 3 ? hull(pts) : null;
      }
      const rgba = (hex, a) => { const h = String(hex).replace('#', ''); if (h.length !== 6) return hex; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };
      let drawQ = 0; const drawSoon = () => { if (!drawQ) drawQ = requestAnimationFrame(() => { drawQ = 0; drawGlows(); }); };
      function drawGlows() {
        const W = svj.clientWidth, H = svj.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1), ctx = svc.getContext('2d');
        if (svc.width !== Math.round(W * dpr) || svc.height !== Math.round(H * dpr)) { svc.width = Math.round(W * dpr); svc.height = Math.round(H * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); GM.hits = []; GM.n = 0;
        if (!svMode || !glowOn() || !GM.live || !W || !H) return;
        const C = camera(W, H); if (!C) return;
        const cur = svTarget && svTarget.b ? svTarget.b.id : null, list = [];
        B.forEach(b => {
          if (b.id !== cur && !shown(b)) return;
          const d = meters([C.la, C.lo], [b.lat, b.lon]); if (d > MAXD + 40) return;
          const hl = outline(b, C); if (!hl) return;
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; hl.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
          if (x1 < -40 || x0 > W + 40 || y1 < -40 || y0 > H + 40 || d > MAXD) return;
          list.push({ b, d, hl, x0, x1, y0, y1 });
        });
        GM.n = list.length;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H - 30); ctx.clip();   /* the bottom strip stays clear for Google's logo and terms */
        list.sort((a, b) => b.d - a.d).forEach(it => {
          const b = it.b, col = COL[b.status], isCur = b.id === cur, isHov = GM.hov === b.id, a = clamp(1.3 - it.d / MAXD, 0.35, 1);
          ctx.save(); ctx.beginPath(); it.hl.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
          ctx.globalAlpha = a; ctx.fillStyle = rgba(col, isCur || isHov ? 0.3 : 0.2); ctx.fill();
          ctx.lineJoin = 'round'; ctx.shadowColor = col; ctx.shadowBlur = isCur ? 30 : 18; ctx.lineWidth = isCur ? 4 : 2.6; ctx.strokeStyle = col;
          if (b.status === 'r') ctx.setLineDash([9, 6]); ctx.stroke(); ctx.setLineDash([]);
          if (isCur || isHov) { ctx.shadowBlur = 0; ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke(); }
          ctx.restore();
        });
        /* a label over each glow near enough to read, nearest first, none on top of another */
        const placed = [], font = '600 12px ' + (cssv('--sans') || 'system-ui, sans-serif');
        ctx.font = font; ctx.textBaseline = 'middle';
        list.slice().sort((a, b) => (a.b.id === cur ? -1 : b.b.id === cur ? 1 : a.d - b.d)).forEach(it => {
          if (it.d > 75 && it.b.id !== cur) return; if (it.x1 - it.x0 < 34 && it.b.id !== cur) return;
          const b = it.b, txt = `${STS[b.status]} · ${b.sc.score}`, w = ctx.measureText(txt).width + 18, h = 22;
          const x = clamp((it.x0 + it.x1) / 2 - w / 2, 4, W - w - 4), y = clamp(it.y0 - h - 6, 4, H - 30 - h - 4);
          if (placed.some(p => x < p[2] && p[0] < x + w && y < p[3] && p[1] < y + h)) return; placed.push([x, y, x + w, y + h]);
          ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle = COL[b.status]; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 11); else ctx.rect(x, y, w, h); ctx.fill();
          if (b.id === cur) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
          ctx.fillStyle = b.status === 'r' ? '#ffffff' : '#10191f'; ctx.fillText(txt, x + 9, y + h / 2 + 0.5); ctx.restore();
        });
        ctx.restore();
        GM.hits = list.sort((a, b) => a.d - b.d);
      }
      /* pointing at a glow names the building; a click makes it the current one, without moving the camera */
      const inPoly = (x, y, P) => { let s = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const yi = P[i][1], xi = P[i][0], yj = P[j][1], xj = P[j][0]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; };
      const hitAt = e => { const r = svj.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; const h = GM.hits.find(it => inPoly(x, y, it.hl)); return h ? h.b : null; };
      let downAt = null;
      svj.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; }, true);
      svj.addEventListener('pointermove', e => {
        if (!glowOn() || !GM.live || (e.buttons & 1)) return; const b = hitAt(e), id = b ? b.id : null;
        if (id !== GM.hov) { GM.hov = id; drawSoon(); }
        if (b) showTip(bTip(b).replace('Click for the full reading · double click for Street View', 'Click to make it the current building'), e); else hideTip();
      }, true);
      svj.addEventListener('pointerleave', () => { if (GM.hov) { GM.hov = null; drawSoon(); } hideTip(); });
      svj.addEventListener('click', e => { if (!glowOn() || !GM.live) return; if (downAt && Math.abs(e.clientX - downAt[0]) + Math.abs(e.clientY - downAt[1]) > 5) return; const b = hitAt(e); if (b) { hideTip(); pick(b.id, { noSV: true }); } }, true);
      const resizePano = () => { try { if (GM.pano && GM.lib && GM.lib.event && GM.lib.event.trigger) GM.lib.event.trigger(GM.pano, 'resize'); } catch (e) { /* the panorama keeps its size */ } };
      if (window.ResizeObserver) new ResizeObserver(() => { resizePano(); drawSoon(); }).observe(svj);

      /* ---------- switching the card, aiming, stepping ---------- */
      function setMode(m) {
        svMode = m === 'sv';
        if (!svMode) { svf.src = 'about:blank'; GM.live = false; GM.hov = null; }   /* unload the plain player before its frame is hidden: at 0 by 0 it logs errors of its own */
        $$('#scMode button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === m)));
        host.hidden = svMode; svw.hidden = !svMode; hideTip();
        $('#scModeNote', root).textContent = svMode ? 'The satellite map is hidden while Street View shows: Google\'s terms keep the two off the same screen. Satellite brings it back.' : 'Pick a building, then Street View to stand in the street in front of it (or double click the building).';
        if (!svMode) { if (svFull) full(false); setTimeout(() => { map.invalidateSize({ pan: false }); if (svTarget) map.panTo([svTarget.lat, svTarget.lon]); }, 0); }
      }
      function full(on) { svFull = !!on; mapCard.classList.toggle('sc-full', svFull); document.documentElement.classList.toggle('sc-noscroll', svFull); if (svMode) { renderSvBar(); drawSoon(); } }
      /* the buildings to step through: those in view when Street View opened, likely ones first, highest scores first */
      function svListNow() {
        const bd = curBounds(), rank = { g: 3, o: 2, r: 1 };
        return [...B.values()].filter(b => bd.contains([b.lat, b.lon]) && shown(b) && b.sys.life !== 'none').sort((a, b) => rank[b.status] - rank[a.status] || b.sc.score - a.sc.score).map(b => b.id);
      }
      async function showSV(target) {
        if (!target) return; const my = ++svTok2; svTarget = target;
        if (!svMode) { viewBounds = map.getBounds(); svList = svListNow(); setMode('sv'); }
        svBar.innerHTML = '<div class="sc-svwhere"><span class="sc-busy"></span>Finding the street in front…</div>';
        let v; try { v = await aim(target); } catch (e) { v = { lat: target.lat, lon: target.lon, heading: 0, road: '', m: 0 }; }
        if (my !== svTok2 || !svMode) return;
        const b = target.b; svView = v; svHead = v.heading; svPitch = pitchFor(b);
        if (glowOn()) {
          svf.src = 'about:blank'; svf.hidden = true; svj.hidden = false;   /* the panorama starts in a box that is on screen */
          try {
            await ensurePano(); if (my !== svTok2 || !svMode) return;
            const d = await findPano(v); if (my !== svTok2 || !svMode) return;
            const cam = latLngOf(d.location.latLng) || [v.lat, v.lon];
            GM.cam = cam; GM.date = d.imageDate || ''; GM.live = true; svf.hidden = true; svf.src = 'about:blank'; svj.hidden = false;
            GM.pano.setPano(d.location.pano); GM.pano.setPov({ heading: b ? bearing(cam, [b.lat, b.lon]) : v.heading, pitch: svPitch }); GM.pano.setZoom(1); GM.pano.setVisible(true); resizePano();
            ensureAround(cam[0], cam[1]); renderSvBar(); drawSoon(); return;
          } catch (e) {
            if (my !== svTok2 || !svMode) return;
            if (GM.failed) toast('Street View glows are off: ' + GM.failed); else toast('No Google panorama near this street: ' + why(e));
          }
        }
        GM.live = false; svj.hidden = true; svf.hidden = false; svf.src = svSrc(v, svHead, svPitch); drawGlows(); renderSvBar();
      }
      function povNow() { return GM.live && GM.pano ? (GM.pano.getPov() || { heading: 0, pitch: 0 }) : { heading: svHead, pitch: svPitch }; }
      function turn(d) {
        if (GM.live && GM.pano) { const p = povNow(); GM.pano.setPov({ heading: ((p.heading + d) % 360 + 360) % 360, pitch: p.pitch }); return; }
        if (!svView) return; svHead = ((svHead + d) % 360 + 360) % 360; svf.src = svSrc(svView, svHead, svPitch); renderSvBar();
      }
      function face() {
        const b = svTarget && svTarget.b; if (!b) return;
        if (GM.live && GM.pano && GM.cam) { GM.pano.setPov({ heading: bearing(GM.cam, [b.lat, b.lon]), pitch: pitchFor(b) }); return; }
        if (svView) { svHead = svView.heading; svf.src = svSrc(svView, svHead, svPitch); renderSvBar(); }
      }
      function step(d) { if (!svList.length) return; const cur = svTarget && svTarget.b ? svList.indexOf(svTarget.b.id) : -1; const i = ((cur + d) % svList.length + svList.length) % svList.length; if (B.get(svList[i])) pick(svList[i]); }
      function whereText() {
        const t = svTarget, b = t && t.b ? (B.get(t.b.id) || t.b) : null, v = svView;
        if (GM.live && GM.cam) {
          const p = povNow(), facing = b && Math.abs(((p.heading - bearing(GM.cam, [b.lat, b.lon]) + 540) % 360) - 180) < 25;
          return `Looking ${compass(p.heading)}${facing ? ' at the building' : ''}${GM.date ? ' · pictures of ' + esc(dateOf(GM.date)) : ''} · <b>${N(GM.n)}</b> building${GM.n === 1 ? '' : 's'} glowing within ${MAXD} m. Drag to look around, use the arrows in the picture to walk the street, point at a glow to name it and click to read it. Esc goes back to the satellite map.`;
        }
        const facing = b && v && Math.abs(((svHead - v.heading + 540) % 360) - 180) < 20;
        return `${v && v.road ? `Standing on ${esc(v.road)}, looking ${compass(svHead)}${facing ? ' at the building' : ''}.` : 'At the street nearest this point.'} Drag to look around; click the arrows in the picture to walk the street. Esc goes back to the satellite map.`;
      }
      const renderWhere = debounce(() => { const w = $('.sc-svwhere', svBar); if (w && svMode) w.innerHTML = whereText(); }, 120);
      function renderSvBar() {
        const t = svTarget; if (!t) { svBar.innerHTML = ''; return; } const b = t.b ? (B.get(t.b.id) || t.b) : null, v = svView;
        if (b && !svList.includes(b.id)) { svList = svListNow(); if (!svList.includes(b.id)) svList.unshift(b.id); }
        const i = b ? svList.indexOf(b.id) : -1, p = povNow(), gl = GM.live && GM.cam ? { lat: GM.cam[0], lon: GM.cam[1], heading: p.heading } : (v ? { lat: v.lat, lon: v.lon, heading: svHead } : t);
        svBar.innerHTML = `<div class="sc-svinfo">${b ? `<span class="sc-pill ${b.status}">${STL[b.status]}</span><b>${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</b><span class="mini">${esc([(PROF[b.cls] || PROF.unk).l, b.sys.short, needLabel(b), 'score ' + b.sc.score].join(' · '))}</span>` : `<b>A point on the map</b><span class="mini">${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</span>`}</div>
          <div class="sc-svctl">
            ${b && svList.length > 1 ? `<button type="button" class="ibtn" data-a="prev" title="The previous building (likely ones first, highest scores first)" aria-label="Previous building">◀</button><span class="mini sc-svn">${N(i + 1)} of ${N(svList.length)}</span><button type="button" class="ibtn" data-a="next" title="The next building" aria-label="Next building">▶</button>` : ''}
            <button type="button" class="ibtn" data-a="left" title="Turn left 45°" aria-label="Turn left">↺</button>${b ? '<button type="button" class="ibtn" data-a="face" title="Turn back to face the building">Face it</button>' : ''}<button type="button" class="ibtn" data-a="right" title="Turn right 45°" aria-label="Turn right">↻</button>
            ${b ? `<span class="seg sc-svck" role="group" aria-label="Your field check">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely']].map(([k, l]) => `<button type="button" data-ck="${k}" aria-pressed="${!!(CK[b.id] && CK[b.id].s === k)}" title="Mark what you see: ${l.toLowerCase()}">${l}</button>`).join('')}</span>` : ''}
            <button type="button" class="ibtn" data-a="full">${svFull ? '⤡ Exit full window' : '⤢ Full window'}</button>
            <a class="ibtn" href="${esc(svURL(gl))}" target="scout-streetview" referrerpolicy="no-referrer" title="Open this view in Google Maps">Google Maps ↗</a>
            <button type="button" class="btn sm" data-a="map">Back to satellite</button>
          </div>
          <div class="sc-svwhere">${whereText()}</div>
          ${glowOn() ? '' : `<form class="sc-svkey" id="scSvKeyF" autocomplete="off"><span><b>Glows over the buildings:</b> ${GM.failed ? esc(GM.failed) + ' ' : ''}the plain player is sealed and says nothing about where it looks, so glows need Google's Street View with a Google Maps key (Maps JavaScript API).</span><input type="password" id="scSvKey" placeholder="Paste a Google Maps key (AIza…)" spellcheck="false" aria-label="Google Maps key"><button class="btn sm" type="submit">Turn on glows</button><a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer">How to get a key ↗</a></form>`}`;
        $$('[data-a]', svBar).forEach(x => x.onclick = () => { const a = x.dataset.a; if (a === 'map') setMode('map'); else if (a === 'full') full(!svFull); else if (a === 'left') turn(-45); else if (a === 'right') turn(45); else if (a === 'face') face(); else if (a === 'prev' || a === 'next') step(a === 'next' ? 1 : -1); });
        $$('[data-ck]', svBar).forEach(x => x.onclick = () => { const k = x.dataset.ck, cur = CK[b.id] && CK[b.id].s; setCheck(b.id, { s: cur === k ? undefined : k }); statusOf(b); draw(b); refreshSoon(); renderSvBar(); drawSoon(); if (sel && sel.type === 'b' && sel.id === b.id) detail(); });
        const kf = $('#scSvKeyF', svBar); if (kf) kf.onsubmit = e => { e.preventDefault(); const k = $('#scSvKey', kf).value.trim(); if (!k) { toast('Paste a key first'); return; } CFG.gKey = k.slice(0, 200); GM.failed = ''; saveCfg(); settings(); toast('Google Maps key saved in this browser'); showSV(svTarget); };
      }
      $$('#scMode button', root).forEach(x => x.onclick = () => {
        if (x.dataset.v === 'map') { if (svMode) setMode('map'); return; }
        if (svMode) return;
        const sb = sel && sel.type === 'b' ? B.get(sel.id) : null;
        if (sb) showSV({ lat: sb.lat, lon: sb.lon, street: sb.street, b: sb });
        else if (sel && sel.type === 'pt') showSV({ lat: sel.lat, lon: sel.lon, street: '', b: null });
        else { const c = map.getCenter(); if (map.getZoom() < 14) toast('Showing the street nearest the map\'s centre. Pick a building to aim at it.'); showSV({ lat: c.lat, lon: c.lng, street: '', b: null }); }
      });
      document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !svMode || root.hidden) return; if (svFull) full(false); else setMode('map'); });

      /* ---------- imagery: which pictures are under the centre of the map ---------- */
      let imgNote = '';
      const imgInfo = debounce(async () => {
        if (VIEWER || CFG.imagery === 'street' || map.getZoom() < 13) return;
        const c = map.getCenter(), bd = map.getBounds(), sz = map.getSize();
        try {
          const j = await getJSON(EP.esri + 'World_Imagery/MapServer/identify?' + qs({ geometry: c.lng.toFixed(6) + ',' + c.lat.toFixed(6), geometryType: 'esriGeometryPoint', sr: 4326, layers: 'all', tolerance: 1, mapExtent: [bd.getWest(), bd.getSouth(), bd.getEast(), bd.getNorth()].map(v => v.toFixed(6)).join(','), imageDisplay: sz.x + ',' + sz.y + ',96', returnGeometry: 'false', f: 'json' }), { timeout: 15000 });
          const r = j.results || [], m = r.find(x => x.layerId === 0), c15 = r.find(x => x.layerId === 8 && x.attributes && x.attributes.SRC_DATE2 && x.attributes.SRC_DATE2 !== 'Null');
          const had = cm15; cm15 = !!c15; if (had !== cm15 && had !== null) setBase(); else if (had === null && !cm15) setBase();
          const a = (m && m.attributes) || {}, d = a.SRC_DATE2 && a.SRC_DATE2 !== 'Null' ? new Date(a.SRC_DATE2) : null;
          imgNote = m ? `Imagery under the centre: ${esc(a.SOURCE || 'Esri')} ${esc(a.SOURCE_INFO || '')}${a['RESOLUTION (M)'] ? ', ' + esc(a['RESOLUTION (M)']) + ' m' : ''}${d && !isNaN(d) ? ', captured ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}${c15 ? `; 15 cm aerial from ${esc(new Date(c15.attributes.SRC_DATE2).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))} at the closest zoom` : ''}.` : '';
          const n2 = $('#scImgNote', root); if (n2) n2.innerHTML = imgNote;
        } catch (e) { /* the date line is a courtesy; the map does not need it */ }
      }, 1200);

      /* ---------- controls ---------- */
      $('#scLayer', root).onchange = e => { CFG.heat = e.target.value; saveCfg(); paintHeat(); };
      $('#scOp', root).oninput = e => { CFG.opacity = +e.target.value; saveCfg(); paintHeat(); };
      $('#scImg', root).onchange = e => { CFG.imagery = e.target.value; saveCfg(); tileErr = 0; tileOk = 0; setBase(); imgInfo(); };
      $('#scKind', root).onchange = e => { CFG.kind = e.target.value; saveCfg(); restyleAll(); refreshSoon(); };
      $('#scFindF', root).onsubmit = async e => {
        e.preventDefault(); const q = $('#scFind', root).value.trim(); if (!q) return;
        if (/^\d{5}$/.test(q)) { if (ZPI[q]) zoomZip(q); else toast('ZIP ' + q + ' is not in the 12 counties'); return; }
        const cz = Z.filter(z => String(z.city).toLowerCase() === q.toLowerCase() && ZPI[z.zip]);
        if (cz.length) { selZip = null; map.fitBounds(LF.latLngBounds(cz.flatMap(z => ZPI[z.zip].rings.flat())), { padding: [20, 20], maxZoom: 14 }); paintHeat(); return; }
        if (VIEWER) { toast('Address search needs the network'); return; }
        try {
          const j = await getJSON(EP.geocode + '?' + qs({ f: 'json', singleLine: q, maxLocations: 1, outFields: 'Match_addr,Addr_type', searchExtent: '-98.6,31.8,-95.4,33.8', location: '-96.8,32.8', countryCode: 'USA' }), { timeout: 15000 });
          const c = (j.candidates || [])[0];
          if (!c || c.score < 75 || !c.location || c.location.y < 31.5 || c.location.y > 34.2 || c.location.x < -99 || c.location.x > -95) { toast('No match in Dallas Fort Worth for that address'); return; }
          pendingPick = { lat: c.location.y, lon: c.location.x }; map.setView([c.location.y, c.location.x], Math.max(19, CFG.minZoom)); toast(c.address); setTimeout(tryPending, 50);
        } catch (err) { toast('Address search failed: ' + why(err)); }
      };
      $('#scCsv', root).onclick = () => exportCSV();
      $('#scLinesGo', root).onclick = () => goModule('lines', selZip ? { zip: selZip } : {});
      $('#scDeskGo', root).onclick = () => { const zs = [...new Set(inViewB().filter(b => b.status === 'g').map(b => b.zip).filter(Boolean))]; const zz = zs.length ? zs : (selZip ? [selZip] : []); if (!zz.length) { toast('Zoom to street level or pick a ZIP first'); return; } goModule('desk', { zips: zz }); };

      /* ---------- the CSV a crew or a mailer can work from ---------- */
      function exportCSV() {
        const bs = inViewB().filter(shown).sort((a, b) => b.sc.score - a.sc.score);
        if (!bs.length) { toast(map.getZoom() < CFG.minZoom ? 'Zoom to street level first' : 'No buildings in view'); return; }
        const header = ['status', 'score', 'likely_need', 'address', 'city', 'zip', 'county', 'use', 'fema_occupancy', 'footprint_sqft', 'height_m', 'year_built', 'year_built_source', 'last_hvac_permit', 'last_hvac_permit_work', 'hvac_permits_on_file', 'likely_system', 'system_odds', 'size', 'controls', 'p_replace_5yr', 'p_repair_12mo', 'p_no_central_air', 'p_still_original', 'p_r22_era', 'service_lines', 'field_check', 'field_cues', 'field_note', 'lat', 'lon', 'street_view'];
        const rows = bs.map(b => { const ck = CK[b.id] || {}; return [STL[b.status], b.sc.score, needLabel(b), b.addr ? title(b.addr) : '', b.city ? title(b.city) : (b.z ? b.z.city : ''), b.zip || '', b.fips ? CNAME(b.fips) : '', (PROF[b.cls] || PROF.unk).l, [b.occ, b.prim].filter(Boolean).join(' / '), Math.round(b.sqft || 0), b.h ? +(+b.h).toFixed(1) : '',
          b.yb || '', b.ybSrc === 'parcel' ? 'county appraisal roll (TxGIO)' : b.ybSrc === 'permit' ? 'new construction permit' : 'estimated from the ZIP', b.last ? b.last.d : '', b.last ? String(b.last.desc).slice(0, 120) : '', b.permits.filter(p => !p.newc).length,
          b.sys.name, b.sys.mix ? b.sys.mix.map(([l, p]) => `${l} ${Math.round(p * 100)}%`).join('; ') : '', b.sys.size, b.sys.controls, +b.sc.P5.toFixed(3), +b.sc.REP.toFixed(3), +b.sc.inst.toFixed(3), +b.state.pOrig.toFixed(3), +b.state.pR22.toFixed(3), b.lines.map(lineName).join('; '),
          ck.s ? STL[ck.s] : '', (ck.cues || []).map(k => (CUES.find(c => c[0] === k) || [k, k])[1]).join('; '), ck.note || '', +b.lat.toFixed(6), +b.lon.toFixed(6), svURL({ lat: b.lat, lon: b.lon })]; });
        const zips = [...new Set(bs.map(b => b.zip).filter(Boolean))], d = new Date().toISOString().slice(0, 10);
        saveFile(`dfw-rooftop-scout-${zips.length === 1 ? zips[0] : 'view'}-${d}.csv`, toCSV(header, rows, `Rooftop Scout, DFW Thermal Debt Atlas, ${d}. Model estimates from public records, not inspections: a status is a probability.\nScore: chance of at least one paid job (replacement within five years, a repair call within twelve months, an installation or hail work). Green at ${CFG.green} or more, orange at ${CFG.orange}.\nSources: FEMA USA Structures; TxGIO StratMap parcels; City of Dallas and City of Fort Worth permits; atlas life tables (EIA RECS 2020 Texas). Street View links open Google Maps.`));
      }

      /* ---------- the method, settings, caveats, gaps and sources ---------- */
      const method = () => [
        `<b>The building ${G('C')}</b>. FEMA's USA Structures inventory (Oak Ridge National Laboratory, the September 2026 release): footprint, height, address and an occupancy class for every structure over about 40 square meters. Its class sets the system profile: a house, an apartment block, a strip center, a school.`,
        `<b>Its age ${G('A')} or ${G('C')}</b>. The year built on the county appraisal roll, read from the Texas Geographic Information Office's statewide parcel file and joined by location; it is filled for Tarrant, Collin, Denton and Wise. Elsewhere a Dallas new construction permit dates it, or the ZIP's ACS year built mix stands in, leaned by the footprint for a house.`,
        `<b>Its last replacement ${G('A')}</b>. Mechanical permits matched to the address: City of Dallas from 2018, City of Fort Worth from 2001. A replacement permit restarts the system's clock at its date; a repair permit moves it a little; one unit's permit in an apartment block moves it by that unit's share.`,
        `<b>The life tables ${G('B')}</b>. The atlas's Weibull lifetimes from EIA RECS 2020 Texas (central AC λ ${D(LIFE.ac.lam, 1)}, k ${D(LIFE.ac.k, 2)}; heat pumps λ ${D(LIFE.hp.lam, 1)}, k ${D(LIFE.hp.k, 2)}), run as a renewal model from the start of the clock: the chance the system in place is still the original, is 15 or older, dates from the R22 era (before 2010), and is replaced within five years. Rooftop units use the cooling table; central plants and PTACs use stated lives (26 and 11.5 year scales).`,
        `<b>Repairs ${G('D')}</b>. Module 05's paid repair call rates by system age: 10%, 18%, 28%, 36% and 45% a year from new to 20 and older, the rates that reproduce the atlas's ZIP repair counts.`,
        `<b>Installation ${G('D')}</b>. Homes without central air: by era (24% before 1940 down to under 1% after 2000), raised for small homes (in full only where the year built is on file, since the footprint already leans the estimated era) and for lower income ZIPs, cut for homes with an HVAC permit on file, and never above 35%. RECS 2020 Texas puts ${D((DATA.recs_tx.acequip || {})[4], 1)}% of homes that cool on room units.`,
        `<b>The score and the colour</b>. The chance of at least one paid job: a replacement within five years, a repair call within twelve months, an installation, or hail work where large hail fell within 8 km since 2023. A building with several units counts the chance any of them needs it, damped by the square root of the count, and the result is weighted by how much of a building like it is conditioned (a parking deck almost none). Green at ${CFG.green} or more, orange at ${CFG.orange} to ${CFG.green - 1}, red below; both cut points are in Settings. An average DFW system scores about 45 (the metro replaces ${P(META.rep / META.sys * 100, 1)} of its systems a year and calls for a repair on about 21%), so by default orange is the typical building, green needs evidence of an older or original system, and red needs evidence of recent work or a new building. A field check replaces the colour.`,
        `<b>The likely system ${G('B')}</b>. From the type, footprint and height, and for homes the ZIP's heating fuel (ACS B25040) with the RECS heat pump share of electric homes (47% single family, 53% apartments). Tonnage is a rule of thumb (500 to 600 square feet a ton in a home, 250 to 400 in a commercial building).`,
      ].map(x => `<li>${x}</li>`).join('');
      $('#scMeth', root).innerHTML = method();
      function settings() {
        const s = $('#scSet', root);
        s.innerHTML = `<div class="f"><label class="fl" for="scMinZ">Buildings appear from zoom</label><select id="scMinZ">${[16, 17, 18].map(z => `<option value="${z}"${z === CFG.minZoom ? ' selected' : ''}>${z}${z === 17 ? ' (street level, the default)' : z === 16 ? ' (wider; more requests)' : ' (closest; fewest requests)'}</option>`).join('')}</select></div>
          <div class="f"><label class="fl" for="scGr">Green at a score of</label><div class="row"><input type="range" id="scGr" min="20" max="90" step="1" value="${CFG.green}"><output id="scGrO">${CFG.green}</output></div></div>
          <div class="f"><label class="fl" for="scOr">Orange at a score of</label><div class="row"><input type="range" id="scOr" min="5" max="85" step="1" value="${CFG.orange}"><output id="scOrO">${CFG.orange}</output></div></div>
          <div class="f"><label class="fl" for="scArc">ArcGIS key (optional)</label><div class="row"><input type="password" id="scArc" autocomplete="off" spellcheck="false" placeholder="${CFG.arcgisKey ? 'Saved: ' + esc(CFG.arcgisKey.slice(0, 4)) + '…' : 'AAPK… or an access token'}"><button class="btn sm" id="scArcS">Save</button><button class="btn sm sec" id="scArcR"${CFG.arcgisKey ? '' : ' disabled'}>Remove</button></div><p class="sc-note">Routes the imagery through your own ArcGIS Location Platform account, the way Esri asks commercial apps to use it (its free tier covers two million basemap tiles a month). Without a key the public World Imagery service is used, with Esri's attribution on the map.</p></div>
          <div class="f"><label class="fl" for="scGk">Google Maps key (for the glows)</label><div class="row"><input type="password" id="scGk" autocomplete="off" spellcheck="false" placeholder="${CFG.gKey ? 'Saved: ' + esc(CFG.gKey.slice(0, 6)) + '…' : 'AIza…'}"><button class="btn sm" id="scGkS">Save</button><button class="btn sm sec" id="scGkR"${CFG.gKey ? '' : ' disabled'}>Remove</button></div><p class="sc-note">Turns on the glows. Street View then runs on Google's Maps JavaScript API, which reports where its camera stands and looks, so every building in the picture gets a green, orange or red glow that follows the view as it turns, zooms and walks. In the Google Cloud console, turn on the Maps JavaScript API for the key and leave it unrestricted by web address (a file opened from this computer sends none; restrict it to that API instead). Google bills Street View loads past its monthly free use. Without a key Street View still plays, through Google's plain embedded player, without glows.</p></div>
          <div class="f"><label class="fl" for="scMlyK">Mapillary token (optional)</label><div class="row"><input type="password" id="scMlyK" autocomplete="off" spellcheck="false" placeholder="${CFG.mlyToken ? 'Saved: ' + esc(CFG.mlyToken.slice(0, 6)) + '…' : 'MLY|…'}"><button class="btn sm" id="scMlyS">Save</button><button class="btn sm sec" id="scMlyR"${CFG.mlyToken ? '' : ' disabled'}>Remove</button></div><p class="sc-note">Shows Mapillary's street photos (CC BY-SA) in the From the road card, turned to face the building. A free client token comes from mapillary.com under Developers. Mapillary's coverage of residential streets is thinner than Street View's.</p></div>
          <div class="f"><label class="fl">Field checks</label><div class="row"><span class="mini">${plural(Object.keys(CK).length, 'building')} checked in this browser.</span><button class="btn sm sec" id="scCkX"${Object.keys(CK).length ? '' : ' disabled'}>Clear them all</button></div></div>`;
        $('#scMinZ', s).onchange = e => { CFG.minZoom = +e.target.value; saveCfg(); restyleAll(); load(); refreshSoon(); };
        const gr = $('#scGr', s), or = $('#scOr', s);
        const thr = () => { CFG.green = +gr.value; if (+or.value >= CFG.green) or.value = CFG.green - 1; CFG.orange = +or.value; $('#scGrO', s).textContent = CFG.green; $('#scOrO', s).textContent = CFG.orange; saveCfg(); B.forEach(statusOf); restyleAll(); refreshSoon(); };
        gr.oninput = thr; or.oninput = thr;
        gr.onchange = or.onchange = () => { if (sel && sel.type === 'b') detail(); $('#scMeth', root).innerHTML = method(); };
        $('#scArcS', s).onclick = () => { const v = $('#scArc', s).value.trim(); if (!v) { toast('Paste a key first'); return; } CFG.arcgisKey = v.slice(0, 500); saveCfg(); tileErr = 0; tileOk = 0; setBase(); settings(); toast('ArcGIS key saved in this browser'); };
        $('#scArcR', s).onclick = () => { CFG.arcgisKey = ''; saveCfg(); tileErr = 0; tileOk = 0; setBase(); settings(); toast('ArcGIS key removed'); };
        $('#scMlyS', s).onclick = () => { const v = $('#scMlyK', s).value.trim(); if (!v) { toast('Paste a token first'); return; } CFG.mlyToken = v.slice(0, 500); saveCfg(); settings(); toast('Mapillary token saved in this browser'); if (sel && sel.type !== 'zip') { const b = sel.type === 'b' ? B.get(sel.id) : null; street(b ? { lat: b.lat, lon: b.lon, street: b.street, b } : { lat: sel.lat, lon: sel.lon, street: '', b: null }); } };
        $('#scMlyR', s).onclick = () => { CFG.mlyToken = ''; saveCfg(); settings(); toast('Mapillary token removed'); };
        const svAgain = () => { if (svMode && svTarget) showSV(svTarget); };
        $('#scGkS', s).onclick = () => { const v = $('#scGk', s).value.trim(); if (!v) { toast('Paste a key first'); return; } CFG.gKey = v.slice(0, 200); GM.failed = ''; saveCfg(); settings(); svAgain(); toast('Google Maps key saved in this browser'); };
        $('#scGkR', s).onclick = () => { CFG.gKey = ''; saveCfg(); settings(); svAgain(); toast('Google Maps key removed'); };
        let armed = false; $('#scCkX', s).onclick = e => { if (!armed) { armed = true; e.target.textContent = 'Click again to clear'; setTimeout(() => { armed = false; if (e.target.isConnected) e.target.textContent = 'Clear them all'; }, 4000); return; } Object.keys(CK).forEach(k => delete CK[k]); store.set(CHECKS, CK); B.forEach(b => statusOf(b)); restyleAll(); settings(); refreshSoon(); if (sel && sel.type === 'b') detail(); toast('Field checks cleared'); };
      }
      settings();
      $('#scCav', root).innerHTML = proseTable([
        ['A colour is a probability', 'Two houses side by side can carry the same score and very different equipment. The model ranks where to look; the roof, the street and the homeowner decide.'],
        ['Most replacements are not permitted', `Module 04 finds about one replacement in five in the city permit files (${P(((META.cal || {})['Fort Worth'] || {}).cap * 100, 0)} in Fort Worth, ${P(((META.cal || {}).Dallas || {}).cap * 100, 0)} in Dallas). A permit on file is strong evidence; no permit is weak evidence.`],
        ['Dallas County has no year built here', 'The statewide parcel file carries no year built for Dallas County (nor for Ellis, Johnson, Kaufman, Parker, Hood, Rockwall or Hunt in the 2026 file), so those buildings are aged from the ZIP. Their scores bunch together more than they would with the real year.'],
        ['FEMA\'s occupancy is modeled', 'USA Structures classes buildings from parcels, points of interest and imagery. A house used as an office, or a shop over apartments, can be classed either way; unclassified buildings are read by size.'],
        ['Rebuilt and remodeled homes', 'An appraisal roll keeps the original year built through most remodels. A full HVAC replacement without a permit leaves no trace the model can read.'],
        ['Units and tons are rules of thumb', 'Rooftop unit counts and tonnage come from floor area, not from counting units on the imagery. Count them on the 15 cm imagery before quoting.'],
        ['Imagery dates differ', 'Satellite and aerial captures under one map are from different days (the line under the map names the one under its centre). Street View and Mapillary have their own dates: Street View shows its date under "View on Google Maps" and "See more dates" in Google Maps.'],
        ['A glow is a drawing, not a detection', 'Each glow is the building\'s FEMA footprint raised to its FEMA height (or a height for its type) and drawn from the panorama\'s own camera position and direction. Trees, fences and nearer buildings are not cut out of it, and a footprint or a height a few meters off moves its edge by as much. The colour is the building\'s reading, as on the map.'],
        ['Street View stands where Google drove', 'The view is aimed from the nearest point of the building\'s own street. Where Google\'s car did not pass (a private drive, a new street) the player picks the nearest picture it has, which can be on the next street; turn, step, or walk with the arrows in the picture.'],
      ], ['Caveat', 'Why it matters']);
      $('#scGap', root).innerHTML = judgList([
        ['The equipment itself', 'No public file lists the make, model, age or refrigerant of a building\'s equipment. A service history, a nameplate photo or a homeowner\'s answer is the only record.'],
        ['Window units from above', 'Room air conditioners rarely show on vertical imagery. Street View and Mapillary can show them on a front or side wall.'],
        ['Permits outside Dallas and Fort Worth', 'Plano, Frisco, Arlington, Irving and the other cities keep their own permit files; the atlas reads only the two with live feeds.'],
        ['Owners and tenants', 'Who owns a building and who lives in it is left out on purpose: this module reads buildings, not people.'],
      ]);
      $('#scSrc', root).innerHTML = srcRows([
        ['Satellite and aerial imagery', 'Esri World Imagery: Vantor Vivid satellite (about 30 cm) and 15 cm aerial where Esri carries it', 'A', 'captures of 2025 and 2026 under DFW', 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9'],
        ['Buildings', 'FEMA USA Structures (Oak Ridge National Laboratory): footprints, occupancy, height, address', 'C', 'September 2026 release', 'https://gis-fema.hub.arcgis.com/pages/usa-structures'],
        ['Year built', 'Texas Geographic Information Office, StratMap Land Parcels (county appraisal district rolls)', 'A', 'most recent, 2026 tax year', 'https://geographic.texas.gov/'],
        ['Dallas permits', 'City of Dallas Open Data, building permits (e7gq-4sah): mechanical and new construction permits', 'A', '2018 on, updated daily', 'https://www.dallasopendata.com/d/e7gq-4sah'],
        ['Fort Worth permits', 'City of Fort Worth development permits (ArcGIS): mechanical permits', 'A', '2001 on, updated hourly', 'https://www.arcgis.com/home/item.html?id=d2740f4d746b4bfaa03e25de0376238b'],
        ['Streets', 'U.S. Census Bureau TIGERweb, transportation layers', 'A', 'current', 'https://tigerweb.geo.census.gov/'],
        ['Address search', 'Esri World Geocoding Service (single searches, nothing stored)', 'A', 'live', 'https://www.esri.com/'],
        ['Life tables and repair rates', 'The atlas: EIA RECS 2020 Texas Weibull lifetimes (module 02), repair call rates by age (module 05), ZIP heating fuel and housing age (ACS)', 'B', 'compiled ' + esc(META.compiled || ''), ''],
        ['Street View', 'Google Street View in the map card, in place of the satellite map: the Maps JavaScript API with your key (with the glows), or Google\'s plain embedded player without one; and Google Maps in its own tab', '', 'live', 'https://developers.google.com/maps/documentation/javascript/streetview'],
        ['Street photos', 'Mapillary API v4, with your token (CC BY-SA 4.0)', '', 'live', 'https://www.mapillary.com/developer/api-documentation'],
      ]);

      /* ---------- the map's events and the first view ---------- */
      const saveView = debounce(() => { const c = map.getCenter(); CFG.view = { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), z: map.getZoom() }; saveCfg(); }, 800);
      map.on('zoomend', () => { paintHeat(); restyleAll(); });
      map.on('moveend', () => { if (!svMode) viewBounds = map.getBounds(); load(); refreshSoon(); imgInfo(); saveView(); });
      map.on('mouseout', hideTip);
      BUS.on('theme', () => { if (self.mounted) { paintHeat(); restyleAll(); } });
      map.attributionControl.addAttribution('Data: FEMA, TxGIO, U.S. Census, Dallas, Fort Worth');
      if (CFG.view) map.setView([CFG.view.lat, CFG.view.lon], CFG.view.z); else map.fitBounds(DFW_BOUNDS, { padding: [10, 10] });
      $('#scSv', root).innerHTML = '<p class="sc-empty">Pick a building, or any point at street level, and Street View opens from the road in front of it, aimed at the building.</p>';
      paintHeat(); detail(); status(); refresh(); load(); imgInfo();
      if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(host);

      /* ---------- what other code may call ---------- */
      self.api = {
        zoomZip, goTo: (la, lo, z) => { map.setView([la, lo], z || 19); pendingPick = { lat: la, lon: lo }; setTimeout(tryPending, 50); },
        map: () => map, buildings: () => [...B.values()], pick: id => pick(id, { pan: true }), glows: () => GM.hits.map(h => ({ id: h.b.id, d: h.d, box: [h.x0, h.y0, h.x1, h.y1] })), sv: () => ({ mode: svMode, live: GM.live, cam: GM.cam, failed: GM.failed, n: GM.n, target: svTarget && svTarget.b ? svTarget.b.id : null }), read, systemOf, addrParts, stateAt, aim, svURL, status: () => ({ tiles: [...T.values()].map(t => ({ k: t.k, st: t.st, n: t.ids.size })), queued: Q.list.length, running: Q.run, errors: errors.slice() }),
      };
      self.version = VERSION;
    },
    onShow() { const m = this.api && this.api.map && this.api.map(); if (m) setTimeout(() => m.invalidateSize({ pan: false }), 0); },
    receive(p) { if (!p || typeof p !== 'object' || !this.api) return; if (typeof p.zip === 'string' && ZPI[p.zip]) this.api.zoomZip(p.zip); else if (isN(p.lat) && isN(p.lon)) this.api.goTo(+p.lat, +p.lon, isN(p.zoom) ? clamp(+p.zoom, 8, 21) : 19); },
    fromRoute(arg) { const a = String(arg || '').trim(); if (/^\d{5}$/.test(a)) return this.receive({ zip: a }); const m = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,(\d+))?$/.exec(a); if (m) this.receive({ lat: +m[1], lon: +m[2], zoom: m[3] ? +m[3] : 19 }); },
  });
})();
