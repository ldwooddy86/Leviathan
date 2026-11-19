<script id="scout-js">
/* ==== rooftop scout ==== */
/* Module 18, Rooftop Scout: the atlas's heatmaps laid over commercial satellite imagery, down to the single roof.
   The ZIP heatmap of any layer in the shared catalog (the same LAYERS modules 01, 04, 05 and 06 draw) sits on Esri World
   Imagery: Vantor satellite imagery of 31 to 50 cm at the closest zoom across
   Louisiana. At street level every building in view is fetched from FEMA's USA Structures inventory, joined to its parcel
   (the year built, in Lafayette Parish), to the reroof, roof work and new construction permits of New Orleans and East Baton
   Rouge Parish (the last time its roof was replaced), and to the NOAA hail, wind and tornado reports around it, and read by
   the atlas's own models: the roof it most likely carries, how old that roof most likely is after every storm that reached
   its ZIP (module 17's roof life and storm resets), how likely it is to need a replacement, a repair,
   or wind or hail work, and which of the eleven service lines that is.
   Green: likely to need the work. Orange: maybe. Red: not likely. A field check from the imagery overrides the model.
   Live Google Street View plays inside the map card, aimed from the street at the building, in place of the satellite map:
   Google's terms (Maps Platform 3.2.3(e)) keep Street View imagery and a non-Google map off the same screen, so the card
   switches between them. With no key at all, the Street view (3D) rebuilds the neighborhood from open data (FEMA
   buildings, Esri imagery, OpenStreetMap streets and alleys) and every building glows in its colour, exactly, because the
   page draws the scene itself; it walks the streets and alleys and rises for the roofs. It is traced from the newest
   satellite photo Esri serves for the place when that photo is from 2024 or later (Vantor's January 16, 2026 picture over
   Baton Rouge, for one): an AI model (SlimSAM, Segment Anything, run on this computer by ONNX Runtime Web) checks every
   building on record against the photo, redraws the ones whose roofs changed, and outlines every tree crown. It is drawn
   the way a game engine draws a scene (a physical sky and sun, sun shadows, ambient occlusion, bloom, filmic tone mapping,
   photo-scanned brick, siding, stucco, asphalt, concrete and bark, windows with frames and glass, foliage of photographed
   leaves). The area exports as a glTF model for Unreal Engine 5 or Blender. With a Google Maps key that has the Map Tiles
   API, the same 3D view can stand on Google's Photorealistic 3D Tiles instead (the photographed mesh behind Google Earth's
   3D), with the glows on top. Past the imagery's finest zoom, the satellite map's AI detail runs Real-ESRGAN on this
   computer's graphics card to draw each tile four times finer, labelled as inferred. Google's photos are one click away,
   and with a Google Maps key (Maps JavaScript API) they glow too. Street photos inside the side panel come from Mapillary
   when a Mapillary token is saved. Every request goes from this browser straight to a public service;
   nothing is sent anywhere else, and the keys a person saves stay in this browser.
   Plain script in the dashboard's own style, on the dashboard's own helpers (registerModule, mastHTML, card, callout,
   kpiHTML, dataTable, layerOptions, zipTip, qScale, legendHTML, saveFile, toCSV, store, toast). Leaflet 1.9.4 is carried
   inline beside it and kept private (window.__SCOUT_LEAFLET__), so no other module sees a global L. */
(function () {
  'use strict';
  if (typeof registerModule !== 'function' || typeof MODS === 'undefined' || typeof MODI === 'undefined' || MODI.rooftops) return;
  const LF = window.__SCOUT_LEAFLET__ || null;
  const KEY = 'rooftops', STORE = 'up.scout.v1', CHECKS = 'up.scout.checks.v1', VERSION = 1;
  const NUM = String(Math.max(0, ...MODS.map(m => +m.num || 0)) + 1).padStart(2, '0');
  const G0 = DATA.geo;
  const NOWD = new Date(), NOW = NOWD.getFullYear() + (NOWD.getMonth() + (NOWD.getDate() - 1) / 31) / 12, THIS_YEAR = NOWD.getFullYear();
  const TILE_Z = 16;                                                     /* buildings, parcels and permits are fetched per zoom 16 tile, about 530 m square here */

  /* ---------- public services: every one keyless and open to a browser (CORS), checked 2026-11-15 ---------- */
  const EP = {
    esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/',
    esriKey: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/',
    bldg: 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query',
    parcel: 'https://services1.arcgis.com/Brg1qbmzmFn7JtpX/arcgis/rest/services/Parish_Parcels__All_/FeatureServer/0/query',
    roads: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/',
    nola: 'https://data.nola.gov/resource/rcm3-fn58.json',
    ebr: 'https://data.brla.gov/resource/7fq7-8j7r.json',
    geocode: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
    mly: 'https://graph.mapillary.com/images',
  };

  /* ---------- settings, kept in this browser ---------- */
  const KINDS = { all: 'Every building', home: 'Homes', apt: 'Apartments and lodging', biz: 'Shops, offices and services', ind: 'Industrial and warehouses', inst: 'Schools, worship, health, government', other: 'Everything else' };
  /* green and orange cut points, set from the atlas's own roof ages (module 17): the average Louisiana roof scores about 21,
     so orange starts a little under the typical roof and green a fifth above it (the proportions of the sibling DFW atlas), green needs
     evidence of an older roof (a known roof of about 14 years or more) or open storm damage, and red needs evidence of a
     newer one (a storm rebuild, a permit or a young building) */
  const DEF = { imagery: 'esri', heat: 'idx', opacity: 0.55, minZoom: 17, green: 26, orange: 19, arcgisKey: '', mlyToken: '', gKey: '', show: { g: true, o: true, r: true }, kind: 'all', view: null, ai: true };
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
    if (typeof s.ai === 'boolean') o.ai = s.ai;
    if (s.view && isN(s.view.lat) && isN(s.view.lon) && isN(s.view.z) && Math.abs(s.view.lat - 31) < 2.6 && Math.abs(s.view.lon + 91.5) < 3.6) o.view = { lat: +s.view.lat, lon: +s.view.lon, z: clamp(Math.round(+s.view.z), 7, 22) };
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
  const CUES = [['tarp', 'Blue tarp or a temporary patch', 'g'], ['missing', 'Missing, lifted or creased shingles', 'g'], ['worn', 'Worn: curling, bare spots, dark streaks or moss', 'g'], ['hail', 'Hail marks: bruised shingles, dented vents or gutters', 'g'], ['ponding', 'Flat roof: ponding, blisters or open seams', 'g'], ['rust', 'Metal roof: rust or backed out fasteners', 'g'], ['new', 'New roof: clean, even colour, fresh flashing', 'r'], ['work', 'Work underway, or a dumpster in the drive', '']];

  /* ---------- small things ---------- */
  const qs = o => Object.keys(o).filter(k => o[k] != null && o[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const meters = (a, b) => { const x = rad(b[1] - a[1]) * Math.cos(rad((a[0] + b[0]) / 2)), y = rad(b[0] - a[0]); return Math.sqrt(x * x + y * y) * 6371008.8; };
  const bearing = (a, b) => { const p1 = rad(a[0]), p2 = rad(b[0]), dl = rad(b[1] - a[1]); return (deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360; };
  const compass = h => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((h % 360) + 360) % 360 / 45) % 8];
  const pct = v => isN(v) ? Math.round(v * 100) + '%' : '—';
  const title = s => String(s || '').toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\b(Ne|Nw|Se|Sw|Us)\b/g, m => m.toUpperCase()).replace(/(\d)(St|Nd|Rd|Th)\b/g, (m, a, b) => a + b.toLowerCase());
  const ymd = ms => { const d = new Date(ms); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
  const monthYear = iso => { const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00Z' : iso); return isNaN(d) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const fracYear = iso => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso)); return m ? +m[1] + (+m[2] - 1 + (+m[3] - 1) / 31) / 12 : null; };
  const plural = (n, one, many) => `${N(n)} ${n === 1 ? one : (many || one + 's')}`;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  /* ---------- the atlas's ZIP and parish shapes, back to latitude and longitude ---------- */
  /* The SVG paths in DATA.geo are drawn in the atlas's own projection (02_map.js: x = (lon - minx) kx sx, y = (maxy - lat) sx,
     whole pixels, about 210 m each). Inverted here they make the heatmap polygons and answer which ZIP a building is in. */
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
  /* metres from a point to the nearest edge of a footprint (0 inside it) */
  function edgeMeters(la, lo, b) {
    if (inBox(la, lo, b.bb) && inRings(la, lo, b.rings)) return 0;
    const k = Math.cos(rad(la)) * 111320, kl = 110900; let best = 1e12;
    b.rings.forEach(r => { for (let i = 0; i + 1 < r.length; i++) { const ax = (r[i][1] - lo) * k, ay = (r[i][0] - la) * kl, bx = (r[i + 1][1] - lo) * k, by = (r[i + 1][0] - la) * kl, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = L2 ? clamp(-(ax * dx + ay * dy) / L2, 0, 1) : 0, px = ax + u * dx, py = ay + u * dy, d = px * px + py * py; if (d < best) best = d; } });
    return Math.sqrt(best);
  }
  const ZP = Object.entries(G0.zcta || {}).map(([zip, d]) => { const rings = pathRings(d); return { zip, rings, bb: bboxOf(rings) }; }).filter(p => p.rings.length);
  const ZPI = {}; ZP.forEach(p => ZPI[p.zip] = p);
  const CTY = Object.entries(G0.parish || {}).map(([f, d]) => ({ fips: f, rings: pathRings(d) }));
  const CTYI = {}; CTY.forEach(c => CTYI[c.fips] = c);
  function zipAt(la, lo) {
    for (const p of ZP) if (inBox(la, lo, p.bb) && inRings(la, lo, p.rings)) return p.zip;
    let best = null, bd = 1e9; Z.forEach(z => { if (!isN(z.lat)) return; const d = meters([la, lo], [z.lat, z.lon]); if (d < bd) { bd = d; best = z.zip; } });
    return bd < 6000 ? best : null;
  }
  const LA_BOUNDS = [[G0.maxy - G0.H / G0.sx, G0.minx], [G0.maxy, G0.minx + G0.W / (G0.kx * G0.sx)]];

  /* ---------- web mercator tiles ---------- */
  const lon2x = (lo, z) => Math.floor((lo + 180) / 360 * Math.pow(2, z));
  const lat2y = (la, z) => { const r = rad(la); return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); };
  const tileBox = (z, x, y) => { const n = Math.pow(2, z), n0 = deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)))), n1 = deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)))); return { w: x / n * 360 - 180, e: (x + 1) / n * 360 - 180, n: n0, s: n1 }; };
  const env = b => [b.w, b.s, b.e, b.n].map(v => v.toFixed(6)).join(',');

  /* ---------- addresses: one key for FEMA, the parcel roll and the two permit files ---------- */
  /* "632 WOODGATE BLVD", "2718 Saint Ann St", "435 E WOODGATE CT BATON ROUGE LA 70808" and "1030 Crete St Apt B" all come
     down to number|core name: suffixes and directions dropped, units and cities cut off. A New Orleans double's range
     ("2824-26 St Ann St", "2616/18 St Philip St") keys on its first number, as FEMA and the parcel roll do. */
  const SUF = { AVENUE: 'AVE', AV: 'AVE', AVE: 'AVE', STREET: 'ST', ST: 'ST', DRIVE: 'DR', DR: 'DR', ROAD: 'RD', RD: 'RD', LANE: 'LN', LN: 'LN', COURT: 'CT', CT: 'CT', CIRCLE: 'CIR', CIR: 'CIR', BOULEVARD: 'BLVD', BLVD: 'BLVD', PLACE: 'PL', PL: 'PL', PARKWAY: 'PKWY', PKWY: 'PKWY', TRAIL: 'TRL', TRL: 'TRL', TERRACE: 'TER', TER: 'TER', HIGHWAY: 'HWY', HWY: 'HWY', FREEWAY: 'FWY', FWY: 'FWY', EXPRESSWAY: 'EXPY', EXPY: 'EXPY', WAY: 'WAY', COVE: 'CV', CV: 'CV', CROSSING: 'XING', XING: 'XING', SQUARE: 'SQ', SQ: 'SQ', POINT: 'PT', PT: 'PT', RIDGE: 'RDG', RDG: 'RDG', LOOP: 'LOOP', PATH: 'PATH', PASS: 'PASS', RUN: 'RUN', ROW: 'ROW', ALLEY: 'ALY', ALY: 'ALY', BEND: 'BND', BND: 'BND', GLEN: 'GLN', GLN: 'GLN', GROVE: 'GRV', GRV: 'GRV', HOLLOW: 'HOLW', HOLW: 'HOLW', LANDING: 'LNDG', LNDG: 'LNDG', PLAZA: 'PLZ', PLZ: 'PLZ', TRACE: 'TRCE', TRCE: 'TRCE', VIEW: 'VW', VW: 'VW', VISTA: 'VIS', WALK: 'WALK', CREEK: 'CRK', CRK: 'CRK', HILL: 'HL', HILLS: 'HLS', MEADOW: 'MDW', MEADOWS: 'MDWS', SPRINGS: 'SPGS', VALLEY: 'VLY', ESTATES: 'ESTS', CANYON: 'CYN', BRANCH: 'BR', BROOK: 'BRK', BLUFF: 'BLF', CREST: 'CRST', FIELD: 'FLD', FIELDS: 'FLDS', GARDENS: 'GDNS', HEIGHTS: 'HTS', MANOR: 'MNR', OVAL: 'OVAL', PIKE: 'PIKE', SPUR: 'SPUR', STRAVENUE: 'STRA' };
  const DIRS = { NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW', N: 'N', S: 'S', E: 'E', W: 'W', NE: 'NE', NW: 'NW', SE: 'SE', SW: 'SW' };
  const isDir = w => /^(N|S|E|W|NE|NW|SE|SW)$/.test(w), isSuf = w => Object.prototype.hasOwnProperty.call(SUF, w);
  function addrParts(s) {
    let t = String(s == null ? '' : s).toUpperCase().split(',')[0].replace(/^\s*(\d+)[A-Z]?\s*[-\/&]\s*\d+[A-Z]?\b/, '$1').replace(/\s+(BATON ROUGE|NEW ORLEANS|LAFAYETTE|BAKER|ZACHARY|CENTRAL|SCOTLANDVILLE)\s+LA\b.*$/, ' ').replace(/\bLA\s+\d{5}(-\d{4})?\s*$/, ' ').replace(/\b(STE|SUITE|UNIT|APT|BLDG|SPC|LOT|RM|FL)\b\s*[:#.]?\s*[A-Z0-9-]*/g, ' ').replace(/#\s*[A-Z0-9-]+/g, ' ').replace(/\bSAINT\b/g, 'ST').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const w = t.split(' ').filter(Boolean); let num = '';
    if (w.length && /^\d+[A-Z]?$/.test(w[0])) num = w.shift().replace(/[A-Z]$/, '');
    let core = w.map(x => DIRS[x] && x.length > 2 ? DIRS[x] : x);
    for (let k = 0; k < 2 && core.length > 1 && (isDir(core[core.length - 1]) || isSuf(core[core.length - 1])); k++) core.pop();
    if (core.length > 1 && isDir(core[0])) core.shift();
    const street = core.join(' ');
    return { num, street, key: num && street ? num + '|' + street : '' };
  }

  /* ---------- what a building is: FEMA's occupancy class ---------- */
  const CLS = {
    'Single Family Dwelling': 'sf', 'Multi - Family Dwelling': 'mf', 'Manufactured Home': 'mh', 'Temporary Lodging': 'hotel', 'Nursing Home': 'care', 'Institutional Dormitory': 'dorm',
    'Retail Trade': 'retail', 'Wholesale Trade': 'whse', 'Professional/Technical Services': 'office', 'Personal and Repair Services': 'svc', 'Entertainment and Recreation': 'ent', 'Medical Office/Clinic': 'med', 'Parking': 'parking', 'Hospital': 'hosp', 'Veterinary/Pet': 'vet', 'Theaters': 'theater', 'Banks': 'bank',
    'General Services': 'gov', 'Emergency Response': 'fire', 'Non-Civilian Structures': 'mil', 'Pre-K - 12 Schools': 'school', 'Other Educational Buildings': 'edu', 'Colleges/Universities': 'college',
    'Religious': 'church', 'Community Center': 'community', 'Indoor Arena': 'arena', 'Convention Center': 'conv', 'Agriculture': 'ag', 'Light': 'ind', 'Heavy': 'indh', 'Food/Drugs/Chemicals': 'indf', 'Metals/Minerals Processing': 'indh',
    'Aviation': 'avn', 'Ground': 'util', 'Rail': 'util', 'Marine': 'util', 'Energy Control Monitoring': 'util',
  };
  /* l: plain name; kind: the filter group */
  const PROF = {
    sf: { l: 'Single family home', kind: 'home' }, mf: { l: 'Apartments or multifamily', kind: 'apt' }, mh: { l: 'Manufactured home', kind: 'home' }, hotel: { l: 'Hotel or motel', kind: 'apt' },
    care: { l: 'Nursing or care home', kind: 'inst' }, dorm: { l: 'Dormitory', kind: 'inst' }, retail: { l: 'Retail', kind: 'biz' }, whse: { l: 'Warehouse or wholesale', kind: 'ind' },
    office: { l: 'Office or professional services', kind: 'biz' }, svc: { l: 'Personal and repair services', kind: 'biz' }, ent: { l: 'Entertainment and recreation', kind: 'biz' },
    med: { l: 'Medical office or clinic', kind: 'inst' }, parking: { l: 'Parking structure', kind: 'other' }, hosp: { l: 'Hospital', kind: 'inst' }, vet: { l: 'Veterinary or pet care', kind: 'biz' },
    theater: { l: 'Theater', kind: 'biz' }, bank: { l: 'Bank', kind: 'biz' }, gov: { l: 'Government building', kind: 'inst' }, fire: { l: 'Fire, police or EMS station', kind: 'inst' },
    mil: { l: 'Secure or military structure', kind: 'inst' }, school: { l: 'School, pre K to 12', kind: 'inst' }, edu: { l: 'Educational building', kind: 'inst' }, college: { l: 'College or university building', kind: 'inst' },
    church: { l: 'Place of worship', kind: 'inst' }, community: { l: 'Community center', kind: 'inst' }, arena: { l: 'Indoor arena', kind: 'inst' }, conv: { l: 'Convention center', kind: 'inst' },
    ag: { l: 'Farm building', kind: 'other' }, ind: { l: 'Light industrial', kind: 'ind' }, indh: { l: 'Heavy industrial', kind: 'ind' }, indf: { l: 'Food, drug or chemical plant', kind: 'ind' },
    avn: { l: 'Aviation building', kind: 'other' }, util: { l: 'Utility or transport shelter', kind: 'other' }, shed: { l: 'Shed or small outbuilding', kind: 'other' },
    garage: { l: 'Detached garage or accessory building', kind: 'home' }, unk: { l: 'Building, use not recorded', kind: 'other' },
  };
  function classify(p) {
    const prim = String(p.PRIM_OCC || '').trim(), occ = String(p.OCC_CLS || '').trim(), sq = +p.SQFEET || 0;
    const c = CLS[prim]; if (c) return c;
    if (sq && sq < 260) return 'shed';
    if (occ === 'Residential') return sq < 950 ? 'garage' : 'sf';
    return sq && sq < 600 ? 'shed' : 'unk';
  }

  /* ---------- roof life: module 17's Weibull roof life and the storms that reset roofs (module 02) ---------- */
  const lanczos = z => { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * lanczos(1 - z)); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; };
  const WB = (META.model && META.model.WB) || { L: 22, k: 3 };
  /* L: mean life in years; k: Weibull shape. Shingles carry the atlas's calibrated life (module 17); membranes and metal
     buildings the atlas's 22 year commercial and multifamily life (module 12); metal homes module 17's "40 years or more";
     manufactured home roofs its "20 years or more" for roof overs (the shapes of the last three are judgment). */
  const LIFE = {
    shingle: { L: +WB.L || 22, k: +WB.k || 3, l: 'asphalt shingles' },
    metal: { L: 40, k: 3, l: 'metal' },
    mh: { L: 20, k: 2.5, l: 'a manufactured home roof' },
    low: { L: 22, k: 3, l: 'a low slope membrane' },
    lowmf: { L: 22, k: 3, l: 'a low slope membrane' },
    mbldg: { L: 22, k: 3, l: 'a metal building roof' },
  };
  Object.values(LIFE).forEach(p => { p.lam = p.L / lanczos(1 + 1 / p.k); });
  const DMG = (META.model && META.model.DMG) || { smax: 0.52, v50: 69.7, w: 7.26 };
  /* the share of one unit roofs a storm's modeled wind damages enough for a roofer (module 02's curve, fitted to FEMA) */
  const dmgShare = kt => isN(kt) && kt >= 34 ? DMG.smax / (1 + Math.exp(-(kt - DMG.v50) / DMG.w)) : 0;
  /* how hard wind and hail take each kind of roof, against shingles: commercial roofs at 70 percent of the residential
     wind rate and 30 percent of its hail rate, apartment membranes at 80 percent of its wind, manufactured homes at 1.3
     times its wind (the atlas's commercial, multifamily and mobile home lines, module 12); metal homes shed wind and hail
     better (judgment) */
  const SMAT = { shingle: 1, metal: 0.45, mh: 1.3, low: 0.7, lowmf: 0.8, mbldg: 0.7 };
  const HMAT = { shingle: 1, metal: 0.5, mh: 0.9, low: 0.3, lowmf: 0.3, mbldg: 0.3 };
  const stormName = s => !s ? '' : s[0] === 'Unnamed' ? `an unnamed ${s[2] >= 1 ? 'hurricane' : 'storm'} (${s[1]})` : `${s[2] >= 1 ? 'Hurricane' : s[2] === 0 ? 'Tropical Storm' : 'storm'} ${s[0]} (${s[1]})`;
  const ktMph0 = kt => Math.round(kt * 1.15078);
  /* The storm resets, exactly as module 17's cohort model made them: from 2000 on, each year's storm driven replacements in
     the ZIP (DATA.rhist: FEMA verified roof and wind damage at two roofs per registration before 2020 and 3.6 since where
     FEMA has it, the best track wind footprint elsewhere), as a share of the ZIP's one unit roofs standing that year (today's homes built before it,
     from the ACS decades); from 1992 to 1999, the wind footprint at module 02's damage curve. Before 1992 the file holds no
     footprints, and by now those resets have worn out of today's roofs. */
  const RH0 = 2000, RH = DATA.rhist || {};
  function standing(z, y) {
    const w = YBK.map(k => Math.max(0, +z[k] || 0)), W = sum(w); if (!W) return 1;
    let s = 0; w.forEach((v, i) => { const [a, b] = BINS[i], lo = i === BINS.length - 1 ? 1900 : a, hi = b + 1; s += v * clamp((y - lo) / (hi - lo), 0, 1); });
    return clamp(s / W, 0.02, 1);
  }
  const SYEARS = new Map();
  function stormsAt(zip) {
    if (SYEARS.has(zip)) return SYEARS.get(zip);
    const z = ZI[zip], rh = RH[zip], by = new Map();
    ((DATA.zstorm || {})[zip] || []).forEach(([si, kt]) => { const s = SIDS[si]; if (!s) return; const y = +s[1], d = dmgShare(kt); const o = by.get(y) || { y, keep: 1, list: [] }; o.keep *= 1 - d; o.list.push({ si, s, kt, d }); by.set(y, o); });
    if (rh && z) rh.forEach((r, i) => { const y = RH0 + i; if (r && r[1] > 0 && !by.has(y)) by.set(y, { y, keep: 1, list: [] }); });
    const out = [];
    by.forEach(o => {
      const dw = 1 - o.keep; let d = dw, src = 'wind';
      if (o.y >= RH0 && rh && z && z.roofs > 0) { const r = rh[o.y - RH0]; d = r ? clamp((+r[1] || 0) / (z.roofs * standing(z, o.y)), 0, 0.95) : 0; src = 'atlas'; }
      if (d > 0.0005 || dw > 0.0005) out.push({ y: o.y, d, dw, src, list: o.list.sort((a, b) => b.d - a.d) });
    });
    out.sort((a, b) => a.y - b.y);
    SYEARS.set(zip, out); return out;
  }
  /* repair calls a year by roof age: shaped by age (judgment) and scaled so the state's roofs, at module 17's ages, make the
     atlas's own count of paid repair jobs (the repair line's pool) */
  const REP_SHAPE = a => a < 5 ? 0.35 : a < 10 ? 0.6 : a < 15 ? 0.95 : a < 20 ? 1.35 : a < 25 ? 1.7 : 2.0;
  const REP_TARGET = META.pools && META.roofs ? clamp(META.pools.repair / META.roofs, 0.005, 0.08) : 0.027;
  const REP_BASE = (() => { const H = (DATA.ts && DATA.ts.agehist) || []; let n = 0, s = 0; H.forEach((v, a) => { n += +v || 0; s += (+v || 0) * REP_SHAPE(a); }); return n && s ? REP_TARGET * n / s : REP_TARGET; })();
  const repRate = a => REP_BASE * REP_SHAPE(a);
  /* the score of the average Louisiana roof at module 17's ages (shingles, no other evidence), for the method's note on the cut points */
  const AVG_SCORE = (() => { const H = (DATA.ts && DATA.ts.agehist) || [], L0 = LIFE.shingle, S = a => Math.exp(-Math.pow(a / L0.lam, L0.k)); let n = 0, s = 0; H.forEach((v, a) => { const p5 = 1 - S(a + 5) / S(a), rp = repRate(a); n += +v || 0; s += (+v || 0) * (1 - (1 - p5) * (1 - rp)); }); return n ? Math.round(s / n * 100) : null; })();
  /* The roof in place, for a clock started in year y0 at a ZIP: year by year the roof wears out on its Weibull life and is
     replaced, and every storm year resets the share of the surviving roofs its modeled wind damaged. Out come the chance
     the roof is still the first one, 15 or older, 20 or older, replaced within five years (age driven) and within twelve
     months, a repair call within twelve months, its mean age, and the storms today's roof most likely dates from. */
  const HMAX = 125, SMEMO = new Map();
  function rstate(mat, zip, y0) {
    const mk = mat + '|' + zip + '|' + y0; if (SMEMO.has(mk)) return SMEMO.get(mk);
    const p = LIFE[mat] || LIFE.shingle, lam = p.lam, kk = p.k, S = a => Math.exp(-Math.pow(a / lam, kk));
    const T = clamp(THIS_YEAR - y0, 0, HMAX), y00 = THIS_YEAR - T, sm = new Map(stormsAt(zip).map(s => [s.y, s])), f = SMAT[mat] || 1;
    let dist = new Float64Array(T + 2); dist[0] = 1; const coh = [];
    for (let i = 1; i <= T; i++) {
      const y = y00 + i, nd = new Float64Array(T + 2); let rep = 0;
      for (let a = 0; a < i; a++) { const v = dist[a]; if (!v) continue; const surv = S(a + 1) / S(a); nd[a + 1] += v * surv; rep += v * (1 - surv); }
      nd[0] += rep;
      coh.forEach(c => { c.m *= S(c.a + 1) / S(c.a); c.a++; });
      const st = sm.get(y);
      if (st && st.d > 0) { const d = clamp(st.d * f, 0, 0.95); let moved = 0; for (let a = 1; a <= i; a++) { const v = nd[a] * d; nd[a] -= v; moved += v; } nd[0] += moved; coh.forEach(c => { c.m *= 1 - d; }); if (moved > 0.002) coh.push({ y, st, m: moved, a: 0 }); }
      dist = nd;
    }
    let pOld15 = 0, pOld20 = 0, age = 0, p5 = 0, p1 = 0, rep = 0;
    for (let a = 0; a <= T; a++) { const v = dist[a]; if (!v) continue; const s0 = S(a); if (a >= 15) pOld15 += v; if (a >= 20) pOld20 += v; age += v * a; p5 += v * (1 - S(a + 5) / s0); p1 += v * (1 - S(a + 1) / s0); rep += v * repRate(a); }
    const storms = coh.filter(c => c.m > 0.01).sort((a, b) => b.m - a.m).slice(0, 3).map(c => ({ y: c.y, si: c.st.list[0] ? c.st.list[0].si : null, kt: c.st.list[0] ? c.st.list[0].kt : null, share: c.m }));
    const o = { pOrig: dist[T], pOld15, pOld20, p5: clamp(p5, 0, 1), p1: clamp(p1, 0, 1), rep, age, t: T, storms };
    SMEMO.set(mk, o); return o;
  }
  const ST_KEYS = ['pOrig', 'pOld15', 'pOld20', 'p5', 'p1', 'rep', 'age', 't'];
  const ZERO = { pOrig: 0, pOld15: 0, pOld20: 0, p5: 0, p1: 0, rep: 0, age: 0, t: 0, storms: [] };
  function mixStates(list) {
    const o = {}; ST_KEYS.forEach(k => o[k] = 0); let W = 0; const sy = new Map();
    list.forEach(([s, w]) => { W += w; ST_KEYS.forEach(k => o[k] += s[k] * w); (s.storms || []).forEach(x => { const e = sy.get(x.y) || { y: x.y, si: x.si, kt: x.kt, share: 0 }; e.share += x.share * w; sy.set(x.y, e); }); });
    if (W > 0) { ST_KEYS.forEach(k => o[k] /= W); sy.forEach(e => e.share /= W); }
    o.storms = [...sy.values()].sort((a, b) => b.share - a.share).slice(0, 3); return o;
  }

  /* ---------- when a building was built, when its year is not on file ---------- */
  /* The ZIP's ACS year built mix (the same ten bins module 17 draws), sharpened for a house by its footprint: an old
     neighborhood's big footprint is more likely a rebuild, a small one more likely original. The footprint medians are a
     judgment call, set wide (a log spread of 0.38) so they lean, not decide. */
  const BINS = [[2020, 2025], [2010, 2019], [2000, 2009], [1990, 1999], [1980, 1989], [1970, 1979], [1960, 1969], [1950, 1959], [1940, 1949], [1905, 1939]];
  const BIN_L = ['2020 or later', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', 'before 1940'];
  const YBK = ['yb20', 'yb10', 'yb00', 'yb90', 'yb80', 'yb70', 'yb60', 'yb50', 'yb40', 'ybold'];
  const FOOT = [2300, 2400, 2450, 2300, 2050, 1800, 1550, 1250, 1100, 1250];
  const binOf = y => { for (let i = 0; i < BINS.length; i++) if (y >= BINS[i][0]) return i; return BINS.length - 1; };
  function ybPrior(b) {
    const z = b.z; let w = z ? YBK.map(k => Math.max(0, +z[k] || 0)) : null;
    if (!w || !(sum(w) > 0)) w = Array.isArray(META.yb) ? META.yb.map(v => +v || 0) : BINS.map(() => 1);
    if (b.cls === 'sf' && b.sqft > 300) { const ls = Math.log(b.sqft); w = w.map((v, i) => v * Math.exp(-Math.pow(ls - Math.log(FOOT[i]), 2) / (2 * 0.38 * 0.38))); }
    const s = sum(w) || 1; return w.map(v => v / s);
  }
  const sampleYears = i => { const [a, b] = BINS[i]; return i === BINS.length - 1 ? [1915, 1928, 1937] : i === 0 ? [2021, 2022, 2024] : [a + 1, Math.round((a + b) / 2), b - 1]; };

  /* ---------- the likely roof ---------- */
  const storiesRes = h => !(h > 0) ? 1 : h < 7.2 ? 1 : h < 10.8 ? 2 : 3;
  const floorsCom = h => !(h > 0) ? 1 : clamp(Math.round((h - 1) / 4), 1, 80);
  const CHECK = {
    res: 'Shingles and their nailing, the underlayment, drip edge, flashing at walls, chimneys and vents, the deck under soft spots, and attic ventilation. A reroof needs a permit (Act 239 of 2025) and the code\'s underlayment and edge details.',
    mh: 'Seams and fasteners on a metal roof, or shingles on a pitched one; roof overs and coatings are the usual jobs, with the tie downs checked after a storm.',
    low: 'Seams, flashings at walls, curbs and drains, ponding water, blisters and wet insulation (a core cut or an infrared scan); restoration and coatings extend a sound membrane.',
    mbldg: 'Fasteners, seams and panel laps, rust at the eaves and around units, skylight panels and gutters; a coating or a retrofit roof over the panels is common.',
    none: 'No roof covering to replace: an open top deck.',
  };
  /* The roof a building most likely carries: the kinds of roof and their odds, its slope, its size in squares (100 square
     feet of roof), what a roofer would check, and the share of a building like it a roofer would expect to work on (factor). */
  function roofOf(b) {
    const z = b.z || {}, c = b.cls, sq = b.sqft || 0, h = b.h || 0;
    const mSh = clamp((isN(z.metal_sh) ? +z.metal_sh : 12) / 100, 0.02, 0.6);
    const steepSq = (pf) => Math.max(1, Math.round(sq * (pf || 1.22) / 100)), lowSq = () => Math.max(1, Math.round(sq * 1.04 / 100));
    const o = { keys: null, mix: null, mat: 'shingle', slope: 'steep', factor: 1, units: 1, name: '', short: '', size: '', check: CHECK.res, squares: 0, metalP: 0 };
    const house = (pre, size) => {
      o.keys = [['shingle', 1 - mSh], ['metal', mSh]]; o.metalP = mSh;
      o.mix = [['Asphalt shingles', (1 - mSh) * 0.96], ['Metal (standing seam or panels)', mSh], ['Tile or slate', (1 - mSh) * 0.04]].sort((x, y) => y[1] - x[1]);
      o.mat = mSh >= 0.5 ? 'metal' : 'shingle'; o.short = o.mix[0][0]; o.squares = steepSq(); o.size = size;
      o.name = pre + (o.mat === 'metal' ? 'metal panels or standing seam over a wood deck, hip or gable' : 'asphalt shingles over a wood deck, hip or gable');
    };
    if (c === 'sf') { const st = storiesRes(h); house('Steep slope roof: ', `${st === 1 ? 'One story' : st + ' stories'}, about ${N(steepSq())} squares of roof`); }
    else if (c === 'garage') { house('Steep slope roof on an outbuilding: ', `about ${N(steepSq())} squares; usually roofed with the house`); o.factor = 0.6; }
    else if (c === 'shed') { house('A small roof: ', `about ${N(steepSq(1.15))} squares`); o.factor = 0.3; o.short = 'Shingles or metal, a small roof'; }
    else if (c === 'mh') { Object.assign(o, { keys: [['mh', 1]], mat: 'mh', short: 'Manufactured home roof', name: 'Manufactured home roof: metal on older single wides, shingles on pitched double wides; roof overs and coatings are common', size: `about ${N(steepSq(1.08))} squares`, check: CHECK.mh, squares: steepSq(1.08) }); }
    else if (c === 'mf') {
      const fl = clamp(Math.round((h - 1.5) / 3.3), 1, 60), gross = sq * fl, units = Math.max(2, Math.round(gross * 0.85 / 900)); o.units = units;
      if (units <= 4) house('Steep slope roof over a duplex to fourplex: ', `${fl === 1 ? 'One story' : fl + ' stories'}, about ${N(units)} units, about ${N(steepSq())} squares`);
      else if (fl <= 3 && sq < 30000) Object.assign(o, { keys: [['shingle', 0.85], ['lowmf', 0.15]], mix: [['Asphalt shingles on pitched roofs', 0.85], ['Low slope membrane', 0.15]], mat: 'shingle', short: 'Pitched shingle roofs (apartments)', name: 'Pitched shingle roofs over garden apartment buildings; low slope sections over breezeways and the larger blocks', size: `${fl === 1 ? 'One story' : fl + ' stories'}, about ${N(units)} units, about ${N(steepSq())} squares`, squares: steepSq() });
      else Object.assign(o, { keys: [['lowmf', 1]], mat: 'low', slope: 'low', short: 'Low slope membrane (mid rise)', name: 'Low slope membrane roof (TPO or modified bitumen) over a mid rise', size: `${fl} floors, about ${N(units)} units, about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
    }
    else if (c === 'parking') Object.assign(o, { keys: [], mat: 'none', slope: 'low', factor: 0.05, short: 'Open deck, no roof covering', name: 'No roof covering: an open top deck (waterproofing and joints only)', check: CHECK.none });
    else if (c === 'util') Object.assign(o, { keys: [['mbldg', 0.6], ['low', 0.4]], mat: 'mbldg', slope: 'low', factor: 0.4, short: 'Metal or a small membrane roof', name: 'Equipment shelter or station: a metal roof or a small membrane roof', size: `about ${N(lowSq())} squares`, check: CHECK.mbldg, squares: lowSq() });
    else if (c === 'ag') Object.assign(o, { keys: [['mbldg', 1]], mat: 'mbldg', slope: 'low', factor: 0.5, short: 'Metal roof (farm building)', name: 'Metal roof on a barn or farm building', size: `about ${N(lowSq())} squares`, check: CHECK.mbldg, squares: lowSq() });
    else if (c === 'whse' || c === 'ind' || c === 'indh' || c === 'indf' || c === 'avn') Object.assign(o, { keys: [['mbldg', 0.6], ['low', 0.4]], mix: [['Metal building roof (R panel or standing seam)', 0.6], ['Low slope membrane (TPO, modified bitumen or built up)', 0.4]], mat: 'mbldg', slope: 'low', short: 'Metal building roof', name: c === 'avn' ? 'A hangar or terminal roof: standing seam metal or a low slope membrane' : 'Metal building roof (R panel or standing seam), or a low slope membrane on older tilt wall and block buildings', size: `about ${N(lowSq())} squares under roof`, check: CHECK.mbldg, squares: lowSq() });
    else {
      /* shops, offices, schools, worship, health, government, arenas and the unrecorded */
      const fl = floorsCom(h), small = sq < 3200 && fl <= 2;
      if (c === 'church' && sq < 12000) Object.assign(o, { keys: [['shingle', 0.5], ['metal', 0.2], ['low', 0.3]], mix: [['Asphalt shingles (sanctuary)', 0.5], ['Low slope membrane (wings)', 0.3], ['Metal', 0.2]], mat: 'shingle', short: 'Shingles, low slope wings', name: 'A steep sanctuary roof in shingles or metal, often with low slope wings for the hall and classrooms', size: `about ${N(steepSq())} squares`, squares: steepSq() });
      else if (small) Object.assign(o, { keys: [['shingle', 0.5], ['metal', 0.15], ['low', 0.35]], mix: [['Asphalt shingles on a pitched roof', 0.5], ['Low slope membrane', 0.35], ['Metal', 0.15]], mat: 'shingle', short: 'Shingles or a small membrane roof', name: 'A small commercial roof: shingles or metal on a pitched roof (often a converted house), or a low slope membrane', size: `about ${N(steepSq())} squares`, squares: steepSq() });
      else if (c === 'school') Object.assign(o, { keys: [['low', 0.7], ['metal', 0.2], ['shingle', 0.1]], mix: [['Low slope membrane', 0.7], ['Standing seam metal', 0.2], ['Asphalt shingles', 0.1]], mat: 'low', slope: 'low', short: 'Low slope membrane, metal on newer wings', name: 'Low slope membrane over the older wings; standing seam metal or shingles on newer buildings', size: `${fl === 1 ? 'One story' : fl + ' floors'}, about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
      else {
        const big = sq >= 60000 && fl <= 2;
        Object.assign(o, { keys: [['low', 0.85], ['mbldg', 0.15]], mix: [['Low slope membrane (TPO, modified bitumen or built up)', 0.85], ['Metal roof', 0.15]], mat: 'low', slope: 'low', short: big ? 'Big box membrane roof' : 'Low slope membrane',
          name: c === 'hosp' ? 'Low slope membrane over a hospital: roof work is phased around rooftop equipment and air intakes' : big ? 'A big box roof: a low slope membrane over a metal deck, many drains and rooftop units' : 'Low slope roof: TPO or modified bitumen membrane (built up and gravel on older buildings)',
          size: `${fl === 1 ? 'One story' : fl + ' floors'}, about ${N(lowSq())} squares`, check: CHECK.low, squares: lowSq() });
      }
    }
    if (o.keys && o.keys.length && !o.mix) o.mix = null;
    return o;
  }

  /* ---------- the storm record around each building: NOAA reports of the last three years ---------- */
  /* Hail of an inch or more, thunderstorm wind of 50 knots (58 mph) or more and tornadoes of EF1 or more, from the atlas's
     NOAA Storm Events points (2016 to 2026), indexed on a grid of 0.05 degree cells */
  const EVY = 3.2;
  const EVS = (typeof PTS !== 'undefined' ? PTS : []).map(p => ({ lat: +p.lat, lon: +p.lon, k: +p.k, mag: +p.mag, y: +p.y, m: +p.m, dw: p.dw, h: p.h, t: +p.y + ((+p.m || 6) - 0.5) / 12 }))
    .filter(p => isN(p.lat) && isN(p.lon) && NOW - p.t <= EVY && NOW - p.t >= -0.1 && ((p.k === 0 && p.mag >= 1) || (p.k === 1 && p.mag >= 50) || (p.k === 2 && p.mag >= 1)));
  const EVG = new Map(); EVS.forEach(p => { const k = Math.floor(p.lat * 20) + ':' + Math.floor(p.lon * 20); if (!EVG.has(k)) EVG.set(k, []); EVG.get(k).push(p); });
  function eventsNear(la, lo) {
    /* a cell is 5.6 km north to south but only 4.7 to 4.8 km east to west at these latitudes, so two cells each way east and west */
    const out = [], i0 = Math.floor(la * 20), j0 = Math.floor(lo * 20);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 2; j <= j0 + 2; j++) (EVG.get(i + ':' + j) || []).forEach(p => { const km = meters([la, lo], [p.lat, p.lon]) / 1000; if (km <= 5) out.push(Object.assign({ km, ago: NOW - p.t, dir: compass(bearing([la, lo], [p.lat, p.lon])) }, p)); });
    return out.sort((a, b) => a.ago - b.ago || a.km - b.km);
  }
  /* the chance a report's hail or wind damaged a roof enough for a roofer, before distance and time (judgment) */
  const hailDmg = in_ => in_ >= 2.5 ? 0.28 : in_ >= 1.75 ? 0.16 : in_ >= 1.25 ? 0.08 : 0.04;
  const windDmg = e => e.k === 1 ? (e.mag >= 65 ? 0.08 : 0.03) : e.mag >= 3 ? 0.6 : e.mag >= 2 ? 0.35 : 0.15;
  /* damage still open after a report: claims settle and roofs are fixed within a year or two */
  const recency = ago => ago <= 1 ? 1 : ago <= 2 ? 0.55 : ago <= 3.2 ? 0.3 : 0;
  const unrep = ago => ago < 0 ? 0 : ago <= 1 ? 0.5 : ago <= 2 ? 0.25 : ago <= 3 ? 0.1 : 0;
  const evLabel = e => e.k === 0 ? `${D(e.mag, 2).replace(/0$/, '')} inch hail` : e.k === 1 ? `${ktMph0(e.mag)} mph thunderstorm wind` : `an EF${e.mag} tornado`;
  const evWhen = e => `${MON[(e.m || 1) - 1]} ${e.y}`;

  /* ---------- reading a building ---------- */
  /* how much a roof permit moves the clock: a reroof restarts it; a repair or a partial reroof moves it a little; a
     renovation that only mentions the roof, roof work on a porch, garage, shed, carport or other accessory structure,
     and rooftop equipment do not move it.
     Replacement wording: a reroof, a tear off, a roof replacement, or replace, remove, change, new or install before a
     roof word, with up to six plain words between (never a preposition, an accessory or structure noun, a repair word
     or 'temporary'). The roof word is not a rooftop unit, rack, deck, line, drain, coating, flashing, insulation, anchor
     or shoring, not the roof of a garage or other accessory (unless the list goes on to the house) and not a roof over a
     slab; 'improperly installed' and the like are not new work.
     Repair wording: a roof leak, repair or damage, missing, broken or damaged shingles, slates or tiles, a spot, minor
     or partial replacement of some of them, a hole in the roof, or a portion or section of it.
     Partial: a reroof or roof replacement the text calls partial weighs as a repair on every permit (partial decking,
     siding, fascia and the like does not count), and so does roof work on part of the house only (an addition, a dormer,
     a lean to, a camelback or an attached shed) on any permit but a reroof permit.
     Accessory: an Accessory Structure permit, or one whose first clause names a garage, shed, carport, storage building
     or other accessory building, does not move the clock when its text never names the house or a main building (a
     house named only as where the accessory stands, as what it is not, or as work under another permit does not count).
     Rooftop equipment (solar, generators, rooftop units, HVAC on the roof, signs, antennas) does not count unless the
     permit also names roof work; a trade list that only mentions HVAC does not make a permit equipment. A reroof permit
     is read as a reroof unless its text is only a repair, calls the reroof partial, or is for an accessory alone. */
  const PW_STOP = String.raw`(?!(?:ON|TO|FROM|AT|IN|OVER|ABOVE|UNDER\w*|BENEATH|BELOW|BEHIND|WHERE|WHICH|THAT|IF|WHEN|NEEDED|REPAIR\w*|ACCESSORY|PAINT\w*|COAT\w*|SEAL(?!\w* TAB)\w*|CLEAN\w*|WASH\w*|INSPECT\w*|FOR|WITH|ONTO|INTO|NEAR|BY|PER|AS|OR|PATIO|PORCH|CARPORT|CAR(?= PORT)|PAVILION|CANOPY|GAZEBO|AWNING|CABANA|SHED|DORMER|COVER(?:ED|ING)?|PERGOLA|BALCONY|GALLERY|STAIR\w*|ADDITION|DECK\w*|ROOF\w*|FRAM(?!ED\b)\w*|STRUCTUR\w*|PARAPET|CHIMNEY|GUTTERS?|SCUPPER|SKYLIGHTS?|DRAIN\w*|EXTENSION|OVERHANG|CANTILEVER\w*|FAN|UNIT|GENERATOR|EQUIPMENT|SOLAR|PANELS?|MODULES?|HVAC|MISSING|BROKEN|LOOSE|CRACKED|LIFTED|BLOWN|SPOT|SOME|FEW|SEVERAL|PIECES?|SECTIONS?|PORTIONS?|PARTS?|AREAS?|PATCH\w*|TEMP\w*)\b)`;
  const PW_TOK = String.raw`(?:(?:THE|ALL|EXISTING|ENTIRE|A|AN|OLD) )*(?:${PW_STOP}[A-Z0-9'’"+/-]+ ){0,6}`;
  /* accessory nouns; a garage counts unless it is attached, a parking, service or repair garage, or one the roof is over or above */
  const PW_ACC = String.raw`PATIO|PORCH|CAR ?PORT|PAVILION|CANOPY|GAZ[EI]BO|AWNING|CABANA|(?<!ATTACHED )SHED|PERGOLA|BALCONY|GALLERY|BREEZEWAY|WALKWAY|STOOP|ACCESSORY|OUTDOOR KITCHEN|POOL ?HOUSE|STORAGE (?:BUILDING|STRUCTURE|SHED|ROOM)|(?<!ATTACHED |PARKING |SERVICE |REPAIR |AUTO |COMMERCIAL |(?:OVER|ABOVE) (?:THE |AN? |EXISTING )*)GARAGE(?! DOOR)`;
  /* an accessory noun right next to a bare reroof word */
  const PW_ACCN = String.raw`(?:${PW_ACC})S?`;
  /* not just after an accessory noun in the same clause, nor after 'partial' */
  const PW_BEHIND = String.raw`(?<!\b(?:${PW_ACC})S?\b[^.;,]{0,30})(?<!\bPARTIAL(?:LY)? (?:[^\s,.;:]+ ){0,2})`;
  /* the roof word, then: not a rooftop unit, rack, line, drain, repair or section, not on or over an accessory, not in a portion */
  const PW_ROOFW = String.raw`(SHINGLE SYSTEM|(?:(?<!(?<!(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN) (?:AND|&) )(?<!ATTACHED |PARKING |SERVICE |REPAIR |AUTO |COMMERCIAL )\bGARAGE )|(?=ROOF(?:ING|S)? (?:AND|&) (?:THE )?(?:MAIN |EXISTING |PRIMARY )?(?:HOUSE|HOME|RESIDENCE|DWELLING)))ROOF(ING|S)?|(?<!(?:DAMAGED?|MISSING|BROKEN|LOOSE|ROTTEN|CRACKED|LIFTED|FEW|SOME|SEVERAL|\b\d{1,2}) )SHINGLES|SHINGLE(?= ?[,.;)]|$)|ROOF COVERING)\b(?![- ]?(MOUNT|TOP|DECK|RACK|FRAM|STRUCT|JOIST|RAFTER|TRUSS|EXHAUST|VENT|ADDITION|LINE|PITCH|DRAIN|HATCH|LADDER|CURB|ACCESS|FAN|UNIT|PENETRAT|OVERHANG|EXTENSION|GARDEN|TERRACE|PATIO|PORCH|SIGN|REPAIR(?!S?\/REPLAC)|LEAK|DAMAGES?\b|SECTION|PORTION|AREA|STUD|BEAM|SUPPORT|COLUMN|POST|WALL|COAT|FLASH(?!\w*,? AND (?:NEW )?(?:SHINGLES|ROOF))|INSUL|ANCHOR|STABIL|SHOR))(?! (?:ON|OVER|AT|FOR|OF|TO|ABOVE) (?:THE |A |AN |NEW |EXISTING |REAR |FRONT |BACK |SIDE |DETACHED |COVERED |OPEN |SCREENED |SMALL |PROPOSED )*(?:${PW_ACC}|DECK|STAIRS?|STEPS|ENTRY|ENTRANCE|POOL|BAR|BARN|WORKSHOP|STUDIO|ARENA|BOAT ?HOUSE|GREENHOUSE|(?:CONCRETE )?SLAB)S?\b(?! (?:AND|&) (?:THE )?(?:MAIN |EXISTING |PRIMARY )?(?:HOUSE|HOME|RESIDENCE|DWELLING)))(?! (?:IN|AT|ON|OF) (?:THE |A |ONE )?(?:(?:REAR|FRONT|BACK|SIDE|LOWER|UPPER|SMALL|FLAT|DAMAGED|LEAKING|AFFECTED) )?(?:PORTION|SECTION|AREA|PART)S?\b)`;
  const PW_REPL = new RegExp(String.raw`(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} (?:ROOF )?)\bRE[- ]?ROOF(ING|ED)?\b(?! (?:OF |ON |AT |FOR |TO )?(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b(?! (?:AND|&|PLUS)\b))|\bRE[- ]?SHINGL|(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} )(?<!\b(?:SPOT|SOME|MINOR|SMALL|FEW|ISOLATED|LOCALI[SZ]ED) (?:(?:SLATE|TILE|SHINGLE|METAL|ASPHALT|CLAY) ){0,2})\bROOF(ING)? (SHINGLE |TILE |SLATE )?REPLACE(MENT|D)?\b(?! (?:OF |ON |AT |FOR |TO )(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b(?! (?:AND|&|PLUS)\b))|\bROOF(ING)? RE-?INSTALL\w*|${PW_BEHIND}\bROOF(ING)? (REMOVAL|TEAR ?-?OFF)\b|\b(REPLAC\w*|NEW|REMOV\w*) (THE |EXISTING )?ROOF DECK(ING|S)?,? (AND |& )?(\w+ ){0,3}(SHINGLES|ROOF(ING)?)\b|${PW_BEHIND}\b(REPLAC(E|ED|ES|ING|EMENT OF)|NEW|REMOV(E|AL|ING)( AND REPLACE| & REPLACE| OF)?|CHANG(E|ED|ING)( OUT)?|R ?[\/&] ?R) ${PW_TOK}${PW_ROOFW}|\bTEAR(ING)? ?-?OFF\b|DOWN TO THE DECK|EXPOSE (THE )?DECK|\bTPO\b|MODIFIED BITUMEN|\bMOD(IFIED)? BIT\b|SINGLE.PLY|\bROOF(ING)? SYSTEM\b|FORTIFI|^ROOFING\b(?!:? (REPAIRS?|LEAKS?|PATCH))|(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} (?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)(?<!\b(?:NO|NONE OF|NO (?:PART|PORTION|SECTION) OF|NOTHING (?:ON|OF)) (?:(?:EXISTING|THE|MAIN) )?(?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)\bROOF(?:ING|S)? (?:(?:ALSO |STILL )?(?:WILL|SHALL|MUST|IS|ARE) (?:ALSO )?BE(?:ING)?|(?:HAS|HAVE|NEEDS?|IS|ARE) TO BE|TO BE|BEING) (?:(?:COMPLETELY|ENTIRELY|FULLY|TOTALLY) )?(?:(?:REMOVED|TORN OFF|STRIPPED) (?:AND|&) )?REPLACED\b(?!,? \(?(?:AS (?:NEEDED|NECESSARY|REQUIRED(?! BY))|WHERE|IF|(?:ONLY )?WHEN (?:NEEDED|NECESSARY|REQUIRED)|ONLY (?:WHERE|IF|AS (?:NEEDED|NECESSARY|REQUIRED(?! BY)))\b|IN (?:THE )?(?:(?:DAMAGED|AFFECTED|DETERIORATED|ROTTED|ROTTEN|LEAKING|SOME|VARIOUS|SEVERAL|CERTAIN|BAD|WORN) )?(?:AREAS?|PLACES?|SECTIONS?|SPOTS?|LOCATIONS?)\b|IN[- ]KIND WHERE|AT (?:THE )?(?:DAMAGED|AFFECTED|LEAK)|AT A LATER DATE|IN THE FUTURE))(?! (?:OF|ON|AT|FOR|TO|OVER|ABOVE) (?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b(?! (?:AND|&|PLUS) (?!(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)|(?:,? (?:(?:AND|&|PLUS) )?(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)*(?:,|,? (?:AND|&|PLUS)|,? AS WELL AS|,? ALONG WITH) (?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*(?:MAIN |ORIGINAL |PRIMARY )?(?:HOUSE|HOME|RESIDENCE|DWELLING)S?\b(?=\s*(?:[.;,)]|$)|,? (?:AND|&|PLUS) (?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)(?!(?:,? (?:(?:AND|&|PLUS) )?(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)*(?:(?: (?:AND|&|PLUS))?(?: (?!(?:WHICH|THAT|WITH|USING|IN|OF|PER|AS|BY|FOR|FROM|DUE|AFTER|UNDER|INCLUDING|ONLY|TO|AND|PLUS)\b)[A-Z]+){1,2})? (?:(?:IS|ARE|WILL|SHALL|MUST|NEEDS?|HAS|HAVE) (?:(?:ALSO|STILL|NOT|TO) )?(?:BE|BEEN|BEING|NOT|REMAIN|STAY)\b|TO (?:BE|REMAIN|STAY|GET|RECEIVE)\b|BEING\b|NOT\b|NEEDS?\b|GETS?\b|REMAINS?\b|STAYS?\b|(?:RE)?PAINT(?:ED|ING)?\b|STAIN(?:ED|ING)?\b|(?:PRESSURE|POWER)[- ]?WASH(?:ED|ING)?\b|REPAIRED\b))))|\b(RE-?INSTALL\w*|DETACH AND RESET)\b[^.;•]{0,60}?\b(ROOF(ING|S)?|SLATES?|TILES?|SHINGLES|SOLAR|FLASHING)\b`);
  /* 'install' counts as replacement wording only on a permit that is not for rooftop equipment */
  const PW_INST = new RegExp(String.raw`${PW_BEHIND}(?<!\b(?:IMPROPERLY|PREVIOUSLY|ORIGINALLY|POORLY|BADLY|ILLEGALLY|WAS|WERE|BEEN|ALREADY) )\bINSTALL(S|ED|ING|ATION OF)? ${PW_TOK}${PW_ROOFW}`);
  const PW_REP = new RegExp(String.raw`\bROOF(ING)? (LEAKS?|REPAIRS?|DAMAGE)\b|\bREPAIR(S|ED|ING)? (OF |TO )?${PW_TOK}ROOF(ING)?\b|\b(REPLAC\w*|REPAIR\w*|RESET\w*|FIX\w*) (THE |ANY |ALL )?(MISSING|BROKEN|LOOSE|CRACKED|DAMAGED?|ROTTEN|SLIPPED|IMPROPERLY)\b[^.;•]{0,25}\b(SLATES?|TILES?|SHINGLES?)\b|\b(REPLAC\w*|REPAIR\w*|INSTALL\w*|RESET\w*) (APPROX\w*\.? |ABOUT |UP TO )?\d{1,2} ([\w-]+ )?(SHINGLES|SLATES|TILES)\b|\b(SHINGLE|METAL|SLATE|TILE) ROOF(ING)? REPAIRS?\b|\bHOLES? IN (THE )?ROOF|\b(PORTION|SECTION|PART|AREA)S? OF (THE )?(\w+ )?ROOF|\bROOF (SECTION|PORTION)S?\b|\bPARTIAL(LY)? ([^\s,.;:]+ ){0,2}(RE-?ROOF|ROOF|REPLACE)|\bPATCH|\bLEAK(?![- ]?BARRIER)|\b(SLATES?|TILES?|SHINGLES?) (THAT |WHICH )?(ARE |IS |WERE )?(DAMAGED|MISSING|BROKEN)\b|\b(SPOT|SOME|MINOR|SMALL|FEW|ISOLATED|LOCALI[SZ]ED) ((SLATE|TILE|SHINGLE|METAL|ASPHALT|CLAY) ){0,2}ROOF(ING)? (SHINGLE |TILE |SLATE )?(REPLACE|REPAIR)\w*|\b(REPLAC\w*|REPAIR\w*) (SOME|A FEW|FEW|SEVERAL) ((OF THE|THE|ROOF|ROOFING|SLATE|TILE|DAMAGED|BROKEN|MISSING|LOOSE|OLD|ROTTEN|CRACKED) ){0,2}(SHINGLES|SLATES|TILES)\b`);
  const PW_ROOFREP = new RegExp(String.raw`\bROOF(ING)? (LEAKS?|REPAIRS?|DAMAGE)|\bREPAIR(S|ED|ING)? (OF |TO )?${PW_TOK}ROOF`);
  const PW_VERB = /\bRE[- ]?ROOF|REPLAC|TEAR|\bNEW ([A-Z0-9'-]+ ){0,3}(ROOF|SHINGLE)|REMOV|CHANG(E|ED|ING)( OUT)?|\bR ?[\/&] ?R\b/;
  const PW_EQUIP = /SOLAR|PHOTOVOLTAIC|\b\d+(\.\d+)? ?KW ?(DC)?\b|\b\d+ (PV )?MODULES\b|\bROOF ?TOP (UNIT|HVAC|A\/C|AIR|PACKAGE|MECHANICAL|EQUIPMENT|EXHAUST|RACK|REFRIGERATION|ANTENNA)|\bRTU\b|\bHVAC (UNITS? |EQUIPMENT |SYSTEM )?(ON|TO) (THE )?ROOF|\bSIGN(S|AGE)?\b|ANTENNA|\bCELL (TOWER|SITE)/;
  /* the first clause names an accessory building as the subject (not one being torn down) */
  const PW_SUBJ = new RegExp(String.raw`^[^.;:,]{0,60}?(?<!\b(?:DEMO\w*|TEAR DOWN|REMOVE|NO)\s(?:\w+ ){0,3})\b(?:(?<!ATTACHED )SHEDS?|(?<!ATTACHED |PARKING |SERVICE |REPAIR |AUTO |COMMERCIAL |(?:OVER|ABOVE) (?:THE |AN? |EXISTING )*)GARAGES?(?! DOORS?)|CAR ?PORTS?|ACCESSORY (?:STRUCTURE|BUILDING|SHED|GARAGE)S?|STORAGE (?:BUILDING|STRUCTURE|SHED|ROOM)S?|CABANAS?|POOL ?HOUSES?|GAZ[EI]BOS?|PAVILIONS?|PERGOLAS?)\b`);
  /* the text names the house or another main building */
  const PW_MAIN = /SINGLE|DOUBLE|DUPLEX|DWELLING|RESIDEN|\bHOMES?\b|(?<!POOL ?|GUEST ?|GREEN ?|BOAT ?|WARE|CLUB|PUMP |CARRIAGE |COACH )HOUSE|TWO.FAMILY|APARTMENT|TOWNHO|MULTI|CONDO|\b(?:MAIN|FRONT|PRIMARY) (?:ROOF|STRUCTURE|BUILDING)|KITCHEN|BEDROOM|LI+VING ROOM|DINING|CHIMNEY/;
  /* the house named only as where an accessory stands, as what it is not, or as work under another permit */
  const PW_NOTMAIN = /\b(?:AT|TO|LOCATED (?:AT|ON)) THE (?:REAR|SIDE|BACK)(?: YARD)? OF (?:AN? |THE )?(?:[\w-]+ ){0,3}(?:RESIDENCE|HOMES?|HOUSE|DWELLING|SINGLE(?:-FAMILY)?|DUPLEX|DOUBLE)\b|\b(?:REAR |SIDE |BACK |FRONT )?YARD OF (?:AN? |THE )?(?:[\w-]+ ){0,3}(?:RESIDENCE|HOMES?|HOUSE|DWELLING|SINGLE(?:-FAMILY)?|DUPLEX|DOUBLE)\b|\b(?:BEHIND|BESIDE|NEXT TO|ADJACENT TO|SERVING|TO SERVE|DETACHED FROM) (?:AN? |THE )?(?:EXISTING )?(?:[\w-]+ ){0,3}(?:RESIDENCE|HOMES?|HOUSE|DWELLING|SINGLE(?:-FAMILY)?|DUPLEX|DOUBLE)\b|\bNO (?:\w+ ){0,2}(?:KITCHEN|BEDROOM|DWELLING)\w*|\bNOT (?:TO )?(?:BE )?(?:USED AS )?(?:AN? )?(?:SEPARATE |SECOND |ADDITIONAL )?(?:DWELLING|LIVING|LIVABLE|RESIDEN)\w*(?: (?:UNIT|SPACE|AREA))?|\bMAIN (?:HOUSE|HOME|RESIDENCE|DWELLING)\b[^.;]{0,60}\bUNDER (?!(?:THIS|THE SAME|SAME|ONE|A SINGLE|THE CURRENT|THE PRESENT)\b)(?:A |ANOTHER |SEPARATE |ITS OWN )?(?:[\w-]+ ){0,2}PERMIT|\bMAIN (?:HOUSE|HOME|RESIDENCE|DWELLING)\b[^.;]{0,60}\bUNDER (?:(?:A |THE )?PERMIT )?(?:(?:#|NO\.? ?)\d|\d{2}-\d{3,})[\w-]*|\b(?:NOT|NOT INCLUDING|EXCLUDING|EXCEPT(?:ING)?(?: FOR)?|WITHOUT)(?: THE)? MAIN (?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\bMAIN (?:HOUSE|HOME|RESIDENCE|DWELLING)\b(?: IS| ARE)? (?:NOT INCLUDED|EXCLUDED|NOT PART OF)\b|\bNO\b[^.;,]{0,40}?\bMAIN (?:HOUSE|HOME|RESIDENCE|DWELLING)\b[^.;,]{0,60}\bUNDER (?:THIS|THE SAME|SAME|ONE)\b[^.;]{0,12}\bPERMIT|\bMAIN (?:HOUSE|HOME|RESIDENCE|DWELLING)\b[^.;,]{0,40}\bNOT\b(?! TO EXCEED| EXCEEDING| INCLUDING| LIMITED| MORE THAN| OVER\b)[^.;,]{0,40}\bUNDER (?:THIS|THE SAME|SAME|ONE)\b[^.;]{0,12}\bPERMIT/g;
  /* a reroof or roof replacement the text calls partial; a bare 'partial replacement' only at the head of a clause and not of a part that is not the roof */
  const PW_PART = /\bPARTIAL(LY)? ((?!DECK|PLYWOOD|SHEATH|OSB|RE-?DECK)[^\s,.;:]+ ){0,2}(RE-?ROOF|NEW (\w+ )?ROOF|ROOF(ING)? (REPLACE|RE-?COVER|SYSTEM|DEMO\w*|TEAR\w*|REMOV\w*))|(?:(?<![A-Z] )|(?<=\bROOF(?:ING)? ))PARTIAL(LY)? REPLACE(MENT|D)?\b(?! OF\b(?! (?:THE |EXISTING |[A-Z]+ ){0,2}(?:ROOF|SHINGLE|SLATE|TILE))| (?:THE|ANY|ALL|EXISTING|ROTTEN|ROTTED|DAMAGED|DETERIORATED|DECK\w*|PLYWOOD|SHEATH\w*|OSB|WOOD|FASCIA|SOFFIT|SIDING|GUTTERS?|WINDOWS?|DOORS?|RAFTERS?|FRAM\w*|BOARDS?|DRIP|FLASH\w*)\b)/;
  /* roof work on part of the house only: the text's first roof word is a roof a work verb puts on an addition, a dormer, a lean to,
     a camelback or an attached shed, or the first clause names a lean to, an attached shed or a rear addition as what the work is
     on; never when the text names the whole roof or the house's roof, or lists the house with the part ('house and new addition
     roof replacement') */
  const PW_PARTT = new RegExp(String.raw`\b(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)? (?:WORK|REPLACEMENT|REPAIRS?|SYSTEM)|(?:SECTION|PORTION|PART|AREA)S? OF (?:THE )?(?:\w+ )?ROOF(?:ING|S)?)\b(?: ONLY)? (?:ON |OVER |AT |OF |FOR |TO |ABOVE )?(?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S?\b(?! OF\b)|\b(?:NEW|REPLAC\w*|REMOV\w*|INSTALL\w*|CONSTRUCT\w*|BUILD|REBUILD\w*|REPAIR\w*|EXTEND\w*|CHANG\w*|TEAR\w*(?: OFF)?|RECOVER\w*|RE-?FRAM\w*)(?:/\w+)? (?:(?:THE|A|AN|EXISTING|OLD|NEW|FLAT|METAL|SHINGLE|TIN|CORRUGATED|GABLE|PITCHED|HIP|SHED|ASPHALT|SLOPED|REAR|SIDE|DAMAGED|LEAKING) ){0,3}ROOF(?:ING|S)?\b (?:ON |OVER |AT |OF |FOR |TO |ABOVE )?(?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S?\b(?! OF\b)|\b(?:NEW|REPLAC\w*|REMOV\w*|INSTALL\w*|CONSTRUCT\w*|BUILD|REBUILD\w*|REPAIR\w*|EXTEND\w*|CHANG\w*|TEAR\w*(?: OFF)?|RECOVER\w*|RE-?FRAM\w*)(?:/\w+)? (?:(?:THE|A|AN|EXISTING|OLD|NEW|FLAT|METAL|SHINGLE|TIN|CORRUGATED|GABLE|PITCHED|HIP|SHED|ASPHALT|SLOPED|REAR|SIDE|DAMAGED|LEAKING) ){0,3}(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S? (?:FLAT |METAL |SHINGLE |TIN |SHED |GABLE )?ROOF(?:ING|S)?\b(?! (?:ATTACHED |ADJACENT )?(?:OVER|ON|AT|FOR|TO|ABOVE|OFF) (?:THE |AN? |NEW |EXISTING |CONCRETE |REAR |FRONT |BACK |SIDE |DETACHED |COVERED |OPEN |SCREENED |SMALL |PROPOSED |WOOD |WOODEN )*(?:${PW_ACC}|PAVERS?|SLAB|DECK|DRIVEWAY|WALKWAY|POOL|HOT TUB|SPA|STAIRS?|STEPS|ENTRY|ENTRANCE|BOAT|BAR|BARN|WORKSHOP|STUDIO|GREENHOUSE)S?\b)`);
  const PW_PARTS = new RegExp(String.raw`^[^.;:,]{0,60}?(?<!\b(?:DEMO\w*|TEAR\w* DOWN|REMOV\w*|NO|CONSTRUCT\w*|BUILD\w*|ADD|ADDING|NEW|PROPOSED)\s(?:\w+ ){0,3})(?<!\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING)S? (?:ROOFS? )?(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT) )*)\b(?:ATTACHED SHED|LEAN.?TO(?: ADDITION)?|(?:REAR|SIDE) ADDITION)\b(?! (?:AND|&|PLUS|WITH) (?:[\w-]+ ){0,2}?(?:RENOVAT|REMODEL)\w*)(?! (?:AND|&|PLUS|TO) (?:AN? |THE )?(?:[\w-]+ ){0,3}?(?:HOUSE|HOME|RESIDENCE|DWELLING|SINGLE|DOUBLE|DUPLEX|STRUCTURE|BUILDING)\b)`);
  const PW_WHOLE = new RegExp(String.raw`\b(?:ENTIRE|WHOLE|FULL|COMPLETE)\b[^.;]{0,20}\bROOF|\bMAIN ROOF|\bROOF(?:ING|S)? (?:ON|OF|OVER|FOR) (?:THE )?(?:ENTIRE |WHOLE |MAIN |ORIGINAL |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\bRE[- ]?ROOF(?:ING|ED)? (?:OF )?(?:THE )?(?:ENTIRE |WHOLE |MAIN |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING|BUILDING)\b|\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN)S? (?:AND|&) (?:THE |REAR |SIDE )?(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S?\b|\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING)S? (?:ROOFS? )?(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT) )*(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S?\b(?=:? (?:(?:FLAT|METAL|SHINGLE|TIN|SHED|GABLE) )?(?:RE[- ]?ROOF|ROOF))|\b(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S? (?:AND|&) (?:THE )?(?:MAIN |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\b(?=ADDITION|LEAN|CAMEL|ATTACHED SHED|DORMER)(?<=\b(?:RE[- ]?ROOF|ROOF)\w*\b[^.;:]{0,40})(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S? (?:AND|&|PLUS) (?:(?:ON|OVER|TO|AT) )?(?:THE )?(?:(?:(?:MAIN|EXISTING|ORIGINAL|OLD|HISTORIC|FRONT|ENTIRE|WHOLE|ONE|TWO|1|2|STORY|SINGLE|FAMILY|[A-Z]+-(?:STORY|FAMILY)) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING)|(?:MAIN|ENTIRE|WHOLE|REST OF THE|REMAINDER OF THE) (?:ROOF|HOUSE))S?\b(?!['’])(?! (?:IS |ARE )?(?:TO|WILL|SHALL) (?:REMAIN|STAY)\b)`);
  const PW_ROOF1 = /\bRE[- ]?ROOF|\bROOF|\bRE[- ]?SHINGL|\bSHINGLE/;
  /* a roof word tied to part of the house: a roof (or its replacement, work, system or covering) on, over, at or of an addition, a
     dormer, a lean to, a camelback or an attached shed, unless the text goes on to the house or the main roof, or such a part's own
     roof or reroof, unless the house comes first in the list ('house and addition roof replacement'), or the roof such a part is built
     with ('rear addition with new roof'), unless that roof goes on over the house or the house comes first in the list. A permit whose replacement
     wording is all on such roofs is a partial reroof unless the rest of the text names the whole roof or the house's roof. */
  const PW_PARTN = String.raw`(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|CAMEL.?BACK|ATTACHED SHED|DORMER)S?`;
  const PW_HOUSEC = String.raw`(?:AND|&|PLUS) (?:(?:ON|OVER|TO|AT) )?(?:THE )?(?:(?:(?:MAIN|EXISTING|ORIGINAL|OLD|HISTORIC|FRONT|ENTIRE|WHOLE|ONE|TWO|1|2|STORY|SINGLE|FAMILY|[A-Z]+-(?:STORY|FAMILY)|SHOTGUN|CREOLE|DOUBLE) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING|SHOTGUN(?! (?:HOUSE|HOME|RESIDENCE|DWELLING|COTTAGE|DOUBLE|SINGLE)S?\b)|DUPLEX|COTTAGE|(?:DOUBLE|SINGLE)(?=\s*(?:[.;,)]|$)))|(?:MAIN|ENTIRE|WHOLE|REST OF THE|REMAINDER OF THE) (?:ROOF|HOUSE))S?\b(?!['’])(?! (?:ROOFS? )?(?:(?:IS|ARE|WILL|SHALL|MUST|TO|DOES|DO|BE|BEING) )*(?:NOT|REMAIN|STAY|EXCLUDED)\w*\b)`;
  /* the house words right after the part, as round 8 read them (a house that starts a new clause there is a known miss) */
  const PW_HOUSE0 = String.raw`(?:AND|&|PLUS) (?:(?:ON|OVER|TO|AT) )?(?:THE )?(?:(?:(?:MAIN|EXISTING|ORIGINAL|OLD|HISTORIC|FRONT|ENTIRE|WHOLE|ONE|TWO|1|2|STORY|SINGLE|FAMILY|[A-Z]+-(?:STORY|FAMILY)) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING)|(?:MAIN|ENTIRE|WHOLE|REST OF THE|REMAINDER OF THE) (?:ROOF|HOUSE))S?\b(?!['’])(?! (?:ROOFS? )?(?:(?:IS|ARE|WILL|SHALL|MUST|TO|DOES|DO|BE|BEING) )*(?:NOT|REMAIN|STAY|EXCLUDED)\w*\b)`;
  /* a house named after a part ends its list item: more accessories or roof components, its roof, then the end of the clause, a comma,
     bracket, dash, colon, number or a preposition; anything else (a verb, other work) starts a new clause or names other work */
  const PW_HEND = String.raw`(?=(?:(?:,|,? (?:AND|&|PLUS)) (?:(?:THE|A|AN|ALL|BOTH|ITS|NEW|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*(?:${PW_ACCN}|PORCHES|GALLERIES|BALCONIES|GUTTERS?|DOWNSPOUTS?|FLASHINGS?|DRIP EDGES?|DECKING|SHEATHING|UNDERLAYMENT|FASCIAS?|SOFFITS?|VENTS?|SKYLIGHTS?)\b)*(?:(?: (?:ROOF(?:ING|S)?|SHINGLES|UNITS?)(?: (?:COVERING|SYSTEM)S?)?)(?:(?:,|,? (?:AND|&|PLUS)) (?:(?:THE|A|AN|ALL|BOTH|ITS|NEW|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*(?:${PW_ACCN}|PORCHES|GALLERIES|BALCONIES|GUTTERS?|DOWNSPOUTS?|FLASHINGS?|DRIP EDGES?|DECKING|SHEATHING|UNDERLAYMENT|FASCIAS?|SOFFITS?|VENTS?|SKYLIGHTS?)\b)*)?(?:\s*(?:[.;,()/+:]|$)|\s+[-–]| (?:\d|W/|(?:WHICH|THAT|WHO|WITH|PER|AS|USING|ACCORDING|DUE|DAMAGED|AFTER|DURING|FROM|BY|IN|ON|AT|OF|FOR|OVER|UNDER|THROUGHOUT|INCLUDING|EXCEPT|ONLY|BOTH|COMPLETE|COMPLETELY|ENTIRELY|FULLY|TOTALLY|APPROX\w*|ABOUT|TO (?:MATCH|(?:[A-Z]+ )?CODE)|MATCHING|MEETING|TOTAL\w*|WITHIN|FOLLOWING|BECAUSE|TOO|ALSO(?=\s*(?:[.;,)]|$)))\b)))`;
  const PW_TIE = new RegExp(String.raw`\b(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)?)(?=(?: (?:AND|&) (?:NEW |EXTERIOR )?(?:SIDING|WALLS?|WINDOWS?|TRIM|FASCIA|SOFFITS?|GUTTERS?|DOWNSPOUTS?|FRAMING|SHEATHING|DOORS?|DECKING|RAFTERS?|JOISTS?|CEILINGS?|FLOORS?|FLOORING|STRUCTURE|SHINGLES|INSULATION|PLYWOOD|DRYWALL|SHEETROCK|FLASHINGS?|WEATHER ?BOARDS?|WEATHERBOARDING|STUCCO|CLADDING|UNDERLAYMENT|FELT|SKYLIGHTS?|SHUTTERS?|VENTS?|EAVES|CORNICES?|RAILINGS?|COLUMNS?|PARAPETS?|BEAMS?|TRUSSES)(?= (?:ON|OVER|AT|OF|FOR|TO|ABOVE) (?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*(?!THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT |DORMER))| (?:SHINGLE |TILE |SLATE )?(?:REPLACEMENT|WORK|SYSTEM|COVERING|SHINGLES|MATERIALS?)|(?: DAMAGED (?:BY|IN|DURING|FROM|AFTER) [^.;,~]{0,30}?,?)? (?:(?:ALSO |STILL )?(?:WILL|SHALL|MUST|IS|ARE) (?:ALSO )?BE(?:ING)?|(?:HAS|HAVE|NEEDS?|IS|ARE) TO BE|TO BE|BEING) (?:(?:COMPLETELY|ENTIRELY|FULLY|TOTALLY) )?(?:(?:REMOVED|TORN OFF|STRIPPED) (?:AND|&) )?REPLACED)? (?:ON|OVER|AT|OF|FOR|TO|ABOVE) (?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*${PW_PARTN}\b(?! OF\b)(?! ${PW_HOUSE0})(?!,? (?:ADDITIONS?,? )?${PW_HOUSEC}${PW_HEND}))|(?<=\b${PW_PARTN} (?:(?:FLAT|METAL|SHINGLE|TIN|SHED|GABLE) )?)(?<!\b(?:(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING|SHOTGUN|DOUBLE|SINGLE|DUPLEX|COTTAGE|FAMILY)S? (?:ROOFS? )?|(?:FRONT|UPPER|ORIGINAL|EXISTING|OLD) (?:(?:SLATE|SHINGLE|TILE|METAL) )?ROOFS? )(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT) )*${PW_PARTN} (?:(?:FLAT|METAL|SHINGLE|TIN|SHED|GABLE) )?)(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)?)\b|(?<=\b${PW_PARTN} WITH (?:(?:A|AN|ITS OWN|ITS|NEW|METAL|SHINGLE|SHINGLED|FLAT|TIN|GABLE|HIP|SHED|PITCHED|ASPHALT|ARCHITECTURAL|STANDING SEAM) ){0,4})(?<!\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING|SHOTGUN|DOUBLE|SINGLE(?!(?<=(?:^|[.;:] ?|\b(?:CONSTRUCT\w*|BUILD\w*|ADD\w*|ERECT\w*|NEW|PROPOSED)(?: OF)?(?: AN?)?(?: NEW)? )SINGLE)(?: AND| &|,) (?:TWO|2|THREE|3|DOUBLE)[- ]STOR(?:Y|IES)\b)|DUPLEX|COTTAGE|FAMILY)S? (?:ROOFS? )?(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT|SECOND|2ND|[A-Z0-9]+-STORY|CAMEL.?BACK) )*${PW_PARTN} WITH (?:(?:A|AN|ITS OWN|ITS|NEW|METAL|SHINGLE|SHINGLED|FLAT|TIN|GABLE|HIP|SHED|PITCHED|ASPHALT|ARCHITECTURAL|STANDING SEAM) ){0,4})(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)?)\b(?! (?:ON|OVER|AT|OF|FOR|TO|ABOVE|COVERING|ACROSS|(?:EXTENDING|EXTENDED|CONTINUING|CONTINUED) (?:OVER|ACROSS|ONTO|TO)) (?:THE |AN? )?(?:(?:ENTIRE|WHOLE|MAIN|EXISTING|ORIGINAL|OLD|PRIMARY) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING)\b)`, 'g');
  const PW_WHOLER = new RegExp(String.raw`\b(?:ENTIRE|WHOLE|FULL|COMPLETE)\b[^.;]{0,20}\bROOF|\bMAIN ROOF|\bROOF(?:ING|S)? (?:ON|OF|OVER|FOR) (?:THE )?(?:ENTIRE |WHOLE |MAIN |ORIGINAL |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\bRE[- ]?ROOF(?:ING|ED)? (?:OF )?(?:THE )?(?:ENTIRE |WHOLE |MAIN |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING|BUILDING)\b|(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} (?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)(?<!\b(?:NO|NONE OF|NO (?:PART|PORTION|SECTION) OF|NOTHING (?:ON|OF)) (?:(?:EXISTING|THE|MAIN) )?(?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)\bROOF(?:ING|S)?\b(?![- ]?(?:DECK|SHEATH|FRAM|STRUCT|JOIST|RAFTER|TRUSS|VENT|FLASH|GUTTER|DRAIN|JACK|PENETRAT|EDGE|CAP|HATCH|CURB|INSUL|COAT|LINE|SURFACE|REPAIR|LEAK|PATCH|DAMAGE(?!D (?:BY|IN|DURING|FROM|AFTER) [^.;,~]{0,30}?,? (?:TO BE|WILL BE|SHALL BE|IS BEING|ARE BEING|BEING) )))(?:(?! (?:NOT|NEVER|MAY|MIGHT|COULD|BE|${PW_ACC}|${PW_PARTN}|PORTION|SECTION|PART|AREA)S?\b)[^.;~]){0,30}\b(?:TO BE|WILL BE|SHALL BE|IS BEING|ARE BEING|BEING) (?:(?:COMPLETELY|ENTIRELY|FULLY|TOTALLY) )?(?:(?:REMOVED|TORN OFF|STRIPPED) (?:AND|&) )?(?:REPLACED|RE-?ROOFED)\b(?!,? \(?(?:AS (?:NEEDED|NECESSARY|REQUIRED(?! BY))|WHERE|IF|(?:ONLY )?WHEN (?:NEEDED|NECESSARY|REQUIRED)|ONLY (?:WHERE|IF|AS (?:NEEDED|NECESSARY|REQUIRED(?! BY)))\b|IN (?:THE )?(?:(?:DAMAGED|AFFECTED|DETERIORATED|ROTTED|ROTTEN|LEAKING|SOME|VARIOUS|SEVERAL|CERTAIN|BAD|WORN) )?(?:AREAS?|PLACES?|SECTIONS?|SPOTS?|LOCATIONS?)\b|IN[- ]KIND WHERE|AT (?:THE )?(?:DAMAGED|AFFECTED|LEAK)|AT A LATER DATE|IN THE FUTURE))`);
  function partOnly(d, R, F) { if (PW_WHOLE.test(d)) return false; const m = PW_PARTT.exec(d); return (!!m && m.index <= d.search(PW_ROOF1)) || ((R || F) && PW_PARTS.test(d)); }
  function permitW(p) {
    if (p.kind === 'newc') return 1;
    if (p.kind === 'mh') return 0.5;
    /* boilerplate that forbids solar work is not solar work */
    const d = String(p.desc || '').toUpperCase().replace(/\bNO (NEW )?SOLAR[^.;]*|SOLAR[^.;]*NOT (BE )?ALLOWED[^.;]*/g, ' ');
    const R = PW_REPL.test(d) || (PW_INST.test(d) && !PW_EQUIP.test(d)), F = PW_REP.test(d), dm = R && p.kind !== 'reroof' ? d.replace(PW_TIE, 'R~F') : '';
    const P = PW_PART.test(d) || (p.kind !== 'reroof' && (partOnly(d, R, F) || (R && !PW_REPL.test(dm) && !(PW_INST.test(dm) && !PW_EQUIP.test(dm)) && !PW_WHOLER.test(dm))));
    if ((p.kind === 'reroof' || R || F) && (p.type === 'Accessory Structure' || PW_SUBJ.test(d)) && !PW_MAIN.test(d.replace(PW_NOTMAIN, ' '))) return 0.15;
    if (p.kind === 'reroof') return (F && !R) || P ? 0.45 : 0.95;
    if (P) return 0.45;
    if (R && !(F && !PW_VERB.test(d))) return 0.8;
    if (PW_EQUIP.test(d) && !PW_ROOFREP.test(d)) return 0.05;
    return F ? 0.35 : 0.15;
  }
  /* the weight a permit carries for one building: its text's weight, times its share when several buildings share its address */
  const permitE = p => (p.w || 0) * (p.share || 1);
  const isReroof = p => p.kind !== 'newc' && permitE(p) >= 0.6;
  function read(b) {
    b.roof = roofOf(b);
    const rf = b.roof, keys = rf.keys || [];
    /* the start of the clock: the year built on file, or the ZIP's mix of years */
    let starts, prior = null;
    if (b.yb) { starts = [[b.yb, 1]]; b.ybMid = b.yb; }
    else { prior = ybPrior(b); starts = []; prior.forEach((w, i) => { if (w > 1e-4) sampleYears(i).forEach(y => starts.push([y, w / 3])); }); b.ybMid = Math.round(sum(starts.map(s => s[0] * s[1]))); b.prior = prior; }
    const zip = b.zip || b.zipF || '';
    const stateFrom = list => keys.length ? mixStates(list.flatMap(([y, w]) => keys.map(([k, kw]) => [rstate(k, zip, Math.min(THIS_YEAR, Math.round(y))), w * kw]))) : Object.assign({}, ZERO);
    let st = stateFrom(starts);
    /* roof permits, oldest first: each restarts the clock by its weight, so a reroof followed by a repair keeps both. The
       builder's roof is still on only if no permit replaced it (pOrig); pPerm is the chance the roof of the last strong
       permit (weight 0.6 or more) is still on, worn down by any weaker permit after it. */
    const rp = b.permits.filter(p => p.kind !== 'newc' && p.w >= 0.3).sort((x, y) => x.y - y.y);
    const strong = rp.filter(p => permitE(p) >= 0.6).pop() || null;
    if (keys.length) rp.forEach(p => { const w = permitE(p), fresh = stateFrom([[Math.floor(p.y), 1]]), o = {}; ST_KEYS.forEach(k => o[k] = w * fresh[k] + (1 - w) * st[k]); o.pOrig = (1 - w) * st.pOrig; o.pPerm = p === strong ? w * fresh.pOrig : (1 - w) * (st.pPerm || 0); const sy = new Map(); [[fresh, w], [st, 1 - w]].forEach(([s, ww]) => (s.storms || []).forEach(x => { const e = sy.get(x.y) || Object.assign({}, x, { share: 0 }); e.share += x.share * ww; sy.set(x.y, e); })); o.storms = [...sy.values()].sort((a, c) => c.share - a.share).slice(0, 3); st = o; });
    const last = rp.length ? rp[rp.length - 1] : null;
    b.state = st; b.last = last; b.lastW = last ? permitE(last) : null; b.strong = strong;
    /* wind and hail since the roof went on: NOAA reports within 5 km in the last three years, and hurricanes or tropical
       storms that reached the ZIP in the last three; a reroof permit after the event closes most of it, and nothing from
       before a building's year on file counts. Reports of one storm (hail, or wind and tornadoes, in the same month and on
       the same weekday within three hours) count once, at the strongest: reports cluster in towns and along roads. */
    const ev = eventsNear(b.lat, b.lon); b.ev = ev;
    const born = b.yb && (b.ybSrc === 'parcel' || b.ybSrc === 'permit') ? b.yb : null;
    const hm = keys.reduce((s, [k, w]) => s + (HMAT[k] || 1) * w, 0) || 0, wm = keys.reduce((s, [k, w]) => s + (SMAT[k] || 1) * w, 0) || 0;
    const after = t => b.permits.some(p => (isReroof(p) || p.kind === 'newc') && p.y > t);
    let keepH = 1, hailTop = null, keepW = 1, windTop = null;
    const days = [];
    ev.forEach(e => {
      if (born && e.t < born) return;
      const g = e.k === 0 ? 0 : 1, d = g === 0 ? hailDmg(e.mag) * clamp(1 - e.km / 5, 0, 1) * recency(e.ago) * hm * (after(e.t) ? 0.15 : 1) : windDmg(e) * clamp(1 - e.km / (e.k === 1 ? 3 : 1.5), 0, 1) * recency(e.ago) * wm * (after(e.t) ? 0.15 : 1);
      if (!(d > 0)) return;
      const o = days.find(x => x.g === g && x.e.y === e.y && x.e.m === e.m && x.e.dw === e.dw && Math.abs((+x.e.h || 0) - (+e.h || 0)) <= 3);
      if (!o) days.push({ g, e, d }); else if (d > o.d) { o.e = e; o.d = d; }
    });
    days.forEach(({ g, e, d }) => { if (g === 0) { keepH *= 1 - d; if (!hailTop || d > hailTop.d) hailTop = { e, d }; } else { keepW *= 1 - d; if (!windTop || d > windTop.d) windTop = { e, d }; } });
    stormsAt(zip).filter(s => THIS_YEAR - s.y <= 3 && s.list.length && !(born && s.y < born)).forEach(s => { const t = s.y + 0.7, ago = NOW - t, d = Math.min(0.95, Math.max(s.d * 1.5, s.dw * 0.5)) * wm * unrep(ago) * (after(t) ? 0.15 : 1);   /* replacements and repairs */ if (d > 0) { keepW *= 1 - d; if (!windTop || d > windTop.d) windTop = { s, d }; } });
    const HAIL = keys.length ? clamp(1 - keepH, 0, 0.6) : 0, WIND = keys.length ? clamp(1 - keepW, 0, 0.6) : 0;
    const P5 = keys.length ? st.p5 : 0, REP = keys.length ? st.rep : 0;
    const need = clamp((1 - (1 - P5) * (1 - REP) * (1 - HAIL) * (1 - WIND)) * rf.factor, 0, 1);
    b.sc = { P5, REP, HAIL, WIND, need, score: Math.round(need * 100), hailTop, windTop };
    /* what the work most likely is */
    const opts = [['replace', P5], ['repair', REP * 1.5], ['storm', WIND * 1.4], ['hail', HAIL * 1.4]].sort((x, y) => y[1] - x[1]);
    const nk = !keys.length || rf.factor < 0.1 ? 'none' : opts[0][0];
    const reset = !!strong, permAge = reset ? Math.round(NOW - strong.y) : 0;
    const top = (st.storms || [])[0], topS = top && top.si != null ? SIDS[top.si] : null;
    /* the builder's roof: its chance (pOrig, which no permit raises) and the building's age, not the clock's */
    const original = !reset && st.pOrig >= 0.35 && THIS_YEAR - (b.yb || b.ybMid || THIS_YEAR) >= 15;
    const wl = windTop ? (windTop.s ? `Wind damage: ${stormName(windTop.s.list[0].s)} reached this ZIP at about ${ktMph0(windTop.s.list[0].kt)} mph` : `Wind damage: ${evLabel(windTop.e)} reported ${D(windTop.e.km, 1)} km ${windTop.e.dir}, ${evWhen(windTop.e)}`) : 'Wind damage';
    const hl = hailTop ? `Hail damage: ${evLabel(hailTop.e)} reported ${D(hailTop.e.km, 1)} km ${hailTop.e.dir}, ${evWhen(hailTop.e)}` : 'Hail damage';
    b.need = { k: nk, l: nk === 'replace' ? (reset && permAge >= 12 ? `Replacement: the roof put on around ${Math.floor(strong.y)} is about ${permAge} years old` : original ? 'Replacement: the builder\'s original roof is likely' : topS && top.share >= 0.25 && THIS_YEAR - top.y >= 13 ? `Replacement: a roof from the ${stormName(topS)} rebuild is likely` : st.pOld20 >= 0.4 ? 'Replacement: a roof 20 years or older is likely' : 'Replacement') : nk === 'repair' ? 'Repair: leaks, worn flashing or a tired section' : nk === 'storm' ? wl : nk === 'hail' ? hl : 'No roofing work expected' };
    /* the atlas's service lines it falls under, by segment as module 12 counts them: manufactured homes and buildings of
       five or more units only in their own lines, commercial roofs in the commercial and coating lines (which carry their
       own wind and hail), one to four unit homes in the residential lines with the top need's line first */
    const L = [], add = id => { if (!L.includes(id) && SLM.LI && SLM.LI[id]) L.push(id); };
    const resi = b.cls === 'sf' || b.cls === 'garage' || b.cls === 'shed' || (b.cls === 'mf' && (rf.units || 0) <= 4), bigMF = b.cls === 'mf' && (rf.units || 0) > 4;
    const comm = !resi && !bigMF && b.cls !== 'mh' && keys.length > 0, lowRoof = rf.mat === 'low' || rf.mat === 'mbldg';
    if (b.cls === 'mh') add('mh');
    else if (bigMF) add('mf');
    else if (comm) { add(nk === 'repair' && lowRoof ? 'coat' : 'comm'); if (lowRoof && st.age >= 8 && st.pOld20 < 0.55) add('coat'); }
    else if (resi && keys.length) {
      if (WIND >= 0.04) add('storm');
      if (HAIL >= 0.04) add('hail');
      if (nk === 'replace') { add(rf.metalP >= 0.5 ? 'metal' : 'replace'); if (b.cls === 'sf' && (b.yb || b.ybMid || 0) < 2020) add('fortified'); if (rf.metalP < 0.5 && rf.metalP >= 0.15) add('metal'); }
      if (REP >= 0.03) add('repair');
      const first = nk === 'replace' ? (rf.metalP >= 0.5 ? 'metal' : 'replace') : nk, i = L.indexOf(first); if (i > 0) { L.splice(i, 1); L.unshift(first); }
    }
    if (b.permits.some(p => p.kind === 'newc' && NOW - p.y < 1.5)) add('newc');
    b.lines = L.slice(0, 4);
    statusOf(b);
    return b;
  }
  function statusOf(b) { const ck = CK[b.id]; b.status = ck && ck.s ? ck.s : b.sc.score >= CFG.green ? 'g' : b.sc.score >= CFG.orange ? 'o' : 'r'; b.checked = !!ck; return b.status; }
  /* the need as the card and the table say it: a building in red that nobody has checked is told as upkeep, not as a job */
  const needLabel = b => b.need.k !== 'none' && b.status === 'r' && !(CK[b.id] && CK[b.id].s) ? 'Not likely now: inspections and upkeep' : b.need.l;
  const STL = { g: 'Likely needs roof work', o: 'Maybe', r: 'Not likely' }, STS = { g: 'Likely', o: 'Maybe', r: 'Not likely' };

  /* ---------- the store of buildings and tiles ---------- */
  const B = new Map(), T = new Map();
  /* parishes whose parcel roll carries a year built in the public parcel layer: Lafayette on most parcels, Vermilion on few
     (mostly homes built since 2017, in the newer subdivisions), so every tile in either parish asks for its parcels */
  const PCOV = { '22055': 'yes', '22113': 'yes' };
  /* parishes with a live roof permit file: Orleans (City of New Orleans) and East Baton Rouge */
  const PFILE = { '22071': 'nola', '22033': 'ebr' };
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
  const quarters = box => { const mx = (box.w + box.e) / 2, my = (box.s + box.n) / 2; return [{ w: box.w, e: mx, s: box.s, n: my }, { w: mx, e: box.e, s: box.s, n: my }, { w: box.w, e: mx, s: my, n: box.n }, { w: mx, e: box.e, s: my, n: box.n }]; };
  async function fetchBuildings(box, depth) {
    const u = EP.bldg + '?' + qs({ where: '1=1', geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'BUILD_ID,OCC_CLS,PRIM_OCC,PROP_ADDR,PROP_CITY,PROP_ZIP,HEIGHT,SQFEET,LATITUDE,LONGITUDE,UUID', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'geojson' });
    const j = await getJSON(u, { timeout: 40000 });
    /* the service sends at most 2,000 buildings and does not page: a fuller box is asked again as four quarters */
    if (j.properties && j.properties.exceededTransferLimit && (depth || 0) < 2) {
      const parts = await Promise.all(quarters(box).map(x => fetchBuildings(x, (depth || 0) + 1)));
      return { features: parts.flatMap(p => p.features || []) };
    }
    return j;
  }
  /* the parcel roll: every parcel in the tile with its shape, joined to the buildings whose centre falls inside it */
  async function fetchParcels(box, depth) {
    const u = EP.parcel + '?' + qs({ where: '1=1', geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'yearbuilt,address,numstories,usedesc,taxyear,county', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'json' });
    const j = await getJSON(u, { timeout: 40000 });
    if (j.exceededTransferLimit && (depth || 0) < 2) return (await Promise.all(quarters(box).map(x => fetchParcels(x, (depth || 0) + 1)))).flat();
    return (j.features || []).map(f => { const a = f.attributes || {}, rings = ((f.geometry && f.geometry.rings) || []).map(rg => rg.map(([lo, la]) => [la, lo])); const yb = parseInt(a.yearbuilt, 10);
      return { rings, bb: rings.length ? bboxOf(rings) : null, yb: yb >= 1880 && yb <= THIS_YEAR ? yb : null, situs: a.address ? String(a.address).trim() : '', use: a.usedesc ? String(a.usedesc) : '', tax: a.taxyear ? String(a.taxyear) : '', parish: a.county ? title(String(a.county)) : '' }; });
  }
  function joinParcels(t, parcels) {
    t.ids.forEach(id => { const b = B.get(id); if (!b || b.parcel) return; const p = parcels.find(q => q.bb && inBox(b.lat, b.lon, q.bb) && inRings(b.lat, b.lon, q.rings)); if (!p) return;
      b.parcel = { yb: p.yb, situs: p.situs, use: p.use, tax: p.tax, parish: p.parish };
      if (p.yb && !b.yb && b.cls !== 'garage' && b.cls !== 'shed') { b.yb = p.yb; b.ybSrc = 'parcel'; }
      if (!b.addr && p.situs && /^\d/.test(p.situs)) { b.addr = p.situs; b.addrSrc = 'parcel'; const a = addrParts(p.situs); b.akey = a.key; b.street = a.street; } });
  }
  /* roof permits in the tile, by their own map points: New Orleans (reroof permits from May 2025, roof work inside renovation
     permits from 2012, new construction from 2012) and East Baton Rouge Parish (reroof permits from July 2025, roof work
     inside remodel permits and new buildings from 2011) */
  const NOLA_TYPES = ['Renovation (Non-Structural)', 'Renovation (Structural)', 'Renovation (Structural or Non-structural)', 'Repair', 'Emergency Permit', 'Accessory Structure'];
  async function fetchPermits(t) {
    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), fips = new Set(bs.map(b => b.fips)), out = [], errs = []; let asked = 0;
    const bx = t.box, wb = `${bx.n.toFixed(6)}, ${bx.w.toFixed(6)}, ${bx.s.toFixed(6)}, ${bx.e.toFixed(6)}`;
    if (fips.has('22071')) {
      asked++;
      const where = `within_box(location_1, ${wb}) AND (code in('ROOF','NEWC') OR (type in(${NOLA_TYPES.map(x => `'${x}'`).join(',')}) AND upper(description) like '%ROOF%'))`;
      try { const j = await getJSON(EP.nola + '?' + qs({ $select: 'address,type,code,issuedate,filingdate,currentstatus,description,constrval,location_1', $where: where, $limit: 5000 }), { timeout: 30000 });
        (Array.isArray(j) ? j : []).forEach(r => { const loc = r.location_1 || {}, la = +loc.latitude, lo = +loc.longitude; if (!isN(la) || !isN(lo) || !la) return; if (/VOID|EXPIRED|DENIED|WITHDR|NOT REQUIRED|ERROR/i.test(r.currentstatus || '')) return;
          const d = String(r.issuedate || r.filingdate || '').slice(0, 10); if (!/^\d{4}-\d\d-\d\d$/.test(d)) return;
          out.push({ lat: la, lon: lo, addr: r.address || '', key: addrParts(r.address).key, d, y: fracYear(d), desc: String(r.description || '').split(/\s*NOTE:/)[0].replace(/\s+/g, ' ').trim(), type: r.type || '', kind: r.code === 'NEWC' ? 'newc' : r.code === 'ROOF' ? 'reroof' : 'roofwork', val: +r.constrval || 0, src: 'City of New Orleans' }); }); }
      catch (e) { errs.push('New Orleans permits: ' + why(e)); }
    }
    if (fips.has('22033')) {
      asked++;
      const where = `within_box(geolocation, ${wb}) AND (permittype like 'Re-Roof%' OR permittype like 'New Building%' OR permittype like 'Manuf%' OR ((permittype like 'Existing Bldg%' OR permittype like 'Damage Assessment%') AND upper(projectdescription) like '%ROOF%'))`;
      try { const j = await getJSON(EP.ebr + '?' + qs({ $select: 'permittype,projectdescription,issueddate,creationdate,streetaddress,projectvalue,geolocation', $where: where, $limit: 5000 }), { timeout: 30000 });
        (Array.isArray(j) ? j : []).forEach(r => { const loc = r.geolocation || {}, la = +loc.latitude, lo = +loc.longitude; if (!isN(la) || !isN(lo) || !la) return;
          const d = String(r.issueddate || r.creationdate || '').slice(0, 10); if (!/^\d{4}-\d\d-\d\d$/.test(d)) return; const ty = String(r.permittype || '');
          out.push({ lat: la, lon: lo, addr: r.streetaddress || '', key: addrParts(r.streetaddress).key, d, y: fracYear(d), desc: String(r.projectdescription || '').replace(/\s+/g, ' ').trim(), type: ty, kind: /^Re-Roof/i.test(ty) ? 'reroof' : /^Manuf/i.test(ty) ? 'mh' : /^New Building/i.test(ty) ? 'newc' : 'roofwork', val: +r.projectvalue || 0, src: 'East Baton Rouge Parish' }); }); }
      catch (e) { errs.push('East Baton Rouge permits: ' + why(e)); }
    }
    out.forEach(p => { p.w = permitW(p); });
    return { list: out, errs, asked };
  }
  /* A permit joins the main building at its address. When several main buildings share the address it joins the one its
     point falls in, else each of them at a share of its weight (a quarter, plus three quarters split among them: a
     permit there may cover one building or all of them), or in full when its text names all the buildings or roofs or
     the entire property. Only the buildings in the permit's own tile count, since buildings and permits load tile by
     tile. A detached garage or shed takes it only when no main building has the address. Without an address match it joins the main building nearest its point within 20 m of the walls,
     and names that building when FEMA gave it no address (New Orleans footprints carry none). A new construction or
     manufactured home permit is mostly for a building FEMA's footprints (2008 to 2012 lidar in the cities) do not have
     yet, so it never spreads over a shared address, never takes an address a nearby permit only guessed, and by its
     point joins only the building it falls in (within 2 m of the walls), never one on file under another address; a
     building's own permits join first. Only a new construction permit filed for the building itself (by address, or by
     a point in its footprint) dates it, and a house, apartment building or manufactured home never by one that reads
     as for an accessory structure alone. The building's own new construction permit, inside its walls, also names it
     over an address a permit 2 to 20 m away only guessed. */
  const ACC_ONLY = /ACCESSORY|\bSHED\b|CAR ?PORT|STORAGE BUILDING|CABANA|\bPOOL\b|(?<!PARKING |SERVICE |ATTACHED )\bGARAGE\b|PAVILION|PERGOLA|GAZEBO|GUEST ?HOUSE|POOL ?HOUSE|CARRIAGE HOUSE|GREENHOUSE/;
  const MAIN_BLDG = /SINGLE|DOUBLE|DUPLEX|DWELLING|RESIDEN|HOME|(?<!POOL ?|GUEST ?|GREEN ?|BOAT ?|WARE|CLUB|PUMP |CARRIAGE |COACH )HOUSE|TWO.FAMILY|(?<!GARAGE )APARTMENT|TOWNHO|MULTI|CONDO|\bSF[RH]\b|LIVABLE AREA|\b\d+ (LIVING |DWELLING |RESIDENTIAL )?UNITS\b/;
  /* the existing house named only as the place an accessory goes, and the accessory a new house comes with */
  const ACC_PLACE = /\b(YARD OF|BEHIND|BESIDE|NEXT TO|ADJACENT TO|SERVING|TO SERVE|FOR|OF|AT|ON|TO|FROM) (AN? |THE )?EXISTING ([\w-]+ ){0,3}(RESIDENCE|HOME|HOUSE|DWELLING|SF[RH]|DUPLEX|DOUBLE|SINGLE(-FAMILY)?|BUILDING)\b|\b(REAR |SIDE |BACK |FRONT )?YARD OF (AN? |THE )?([\w-]+ ){0,3}(RESIDENCE|HOME|HOUSE|DWELLING|SF[RH]|DUPLEX|DOUBLE|SINGLE(-FAMILY)?)\b/g;
  const ACC_WITH = /\b(WITH|W\/|AND|PLUS|INCLUDING) (AN? |NEW |DETACHED |ATTACHED |REAR |TWO |\d+ ?(SF|SQ ?FT|S\.F\.)? )*(ACCESSORY|GARAGE|CAR ?PORT|SHED|POOL|CABANA|PORCH|DECK|STORAGE)\w*( (STRUCTURE|BUILDING)S?)?/g;
  /* New Orleans' 2012 import tail ('Historical Import Type: Permits Residential Single ...') names the permit's class, not the building */
  const accOnly = u => { const v = u.replace(/\s*HISTORICAL IMPORT TYPE:.*$/, '').replace(ACC_PLACE, ' '); return ACC_ONLY.test(v.replace(ACC_WITH, ' ')) && !MAIN_BLDG.test(v); };
  /* a permit whose text names every building or roof at the address, or the entire property, covers each of them in full */
  const PW_ALL = /\b(?:ALL|EVERY|EACH)(?: OF)?(?: THE)? (?!OTHER\b)(?:[A-Z0-9'’&-]+ ){0,4}?(?:BUILDINGS|BLDGS)\b|\b(?:REPLAC\w*|RE-?ROOF\w*)(?: OF)? (?:ALL|EVERY|EACH)(?: OF)?(?: THE)? (?:[A-Z0-9'’&-]+ ){0,4}?ROOFS\b|\bENTIRE (?:COMPLEX|PROPERTY)\b/;
  function joinPermits(t, res) {
    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), byKey = new Map();
    const index = b => { if (!b.akey) return; const g = byKey.get(b.akey) || []; if (!g.includes(b)) g.push(b); byKey.set(b.akey, g); };
    bs.forEach(index);
    const sigOf = p => p.d + '|' + p.desc.slice(0, 60), give = (b, p) => { const s = sigOf(p); if (b.permits.some(q => sigOf(q) === s)) return false; b.permits.push(p); b.permits.sort((x, y) => y.y - x.y); return true; };
    const isNew = p => p.kind === 'newc' || p.kind === 'mh';
    res.list.slice().sort((a, c) => isNew(a) - isNew(c)).forEach(p => {
      const nw = isNew(p), at = (p.key && byKey.get(p.key)) || [], main = at.filter(b => b.cls !== 'garage' && b.cls !== 'shed');
      let targets = (main.length ? main : at).filter(b => !nw || b.addrVia !== 'near' || edgeMeters(p.lat, p.lon, b) <= 2);
      if (targets.length > 1) { const inside = targets.filter(b => edgeMeters(p.lat, p.lon, b) === 0); targets = inside.length ? inside : nw ? [] : targets; }
      if (targets.length) { p.via = 'addr'; p.share = targets.length > 1 && !PW_ALL.test(String(p.desc || '').toUpperCase()) ? 0.25 + 0.75 / targets.length : 1; targets.forEach(b => give(b, p)); return; }
      let best = null, bd = 1e9;
      bs.forEach(b => { if (b.cls === 'shed' || (nw && b.akey && b.akey !== p.key && b.addrVia !== 'near')) return; const d = edgeMeters(p.lat, p.lon, b) + (b.cls === 'garage' ? 6 : 0); if (d < bd) { bd = d; best = b; } });
      if (!best || bd > (nw ? 2 : 20)) return;
      p.via = bd <= 2 ? 'in' : 'near';
      if (!give(best, p)) return;
      /* a building FEMA gave no address takes the permit's; its own new construction permit, inside its walls, names it over an address a permit 2 to 20 m away only guessed */
      if (p.addr && (!best.addr || (nw && p.via === 'in' && best.addrVia === 'near' && p.key !== best.akey))) { if (best.akey && byKey.has(best.akey)) byKey.set(best.akey, byKey.get(best.akey).filter(x => x !== best)); best.addr = String(p.addr).replace(/\s+(BATON ROUGE|NEW ORLEANS)\s+LA\b.*$/i, ''); best.addrSrc = 'permit'; best.addrVia = p.via; const a = addrParts(p.addr); best.akey = a.key; best.street = a.street; index(best); }
    });
    bs.forEach(b => {
      if (b.yb || b.cls === 'garage' || b.cls === 'shed') return;
      const nc = b.permits.filter(p => p.kind === 'newc' && (p.via === 'addr' || p.via === 'in') && !(['sf', 'mf', 'mh'].includes(b.cls) && accOnly(String(p.desc || '').toUpperCase()))).sort((x, y) => x.y - y.y)[0];
      if (nc) { b.yb = Math.floor(nc.y); b.ybSrc = 'permit'; b.ybFromPermit = true; }
    });
  }
  /* streets near the tile from the Census TIGER file, for standing Street View on the road in front of a building */
  async function roadsFor(t) {
    if (t.roads) return t.roads; if (t.roadsP) return t.roadsP; if (t.roadsBad && Date.now() - t.roadsBad.at < 120000) return t.roadsBad.rs;
    const pad = 0.0012, box = { w: t.box.w - pad, e: t.box.e + pad, s: t.box.s - pad, n: t.box.n + pad };
    t.roadsP = Promise.all([8, 6].map(L => getJSON(EP.roads + L + '/query?' + qs({ geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,MTFCC', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'json' }), { timeout: 25000 }).catch(() => ({ features: [], failed: true }))))
      .then(js => { const rs = [], bad = js.some(j => j.failed); js.forEach(j => (j.features || []).forEach(f => { const nm = f.attributes && f.attributes.NAME && f.attributes.NAME !== 'Null' ? f.attributes.NAME : ''; ((f.geometry && f.geometry.paths) || []).forEach(p => rs.push({ name: nm, core: nm ? addrParts('1 ' + nm).street : '', m: (f.attributes && f.attributes.MTFCC) || '', line: p.map(([lo, la]) => [la, lo]) })); })); t.roadsP = null; if (bad) { rs.failed = true; t.roadsBad = { at: Date.now(), rs }; } else { t.roads = rs; t.roadsBad = null; } return rs; });   /* a failed answer is asked again after two minutes */
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
    key: KEY, num: NUM, title: 'Rooftop Scout', desc: 'The heatmaps on commercial satellite imagery, down to the roof: rooftops, Street View from the road, and every building marked for a likely replacement, repair or storm and hail work with its likely roof',
    mount(root) {
      const self = this;
      const VIEWER = inViewer();
      const lineName = id => (SLM.LI[id] || {}).short || id;
      root.innerHTML = mastHTML({ eyebrow: `Module ${NUM} · Rooftop Scout · satellite, street and roof level`, title: 'Rooftop Scout',
        dek: 'Fly over the atlas\'s heatmaps on commercial satellite imagery, drop to the street, and read every roof in view: what it is most likely made of, how old it most likely is after every storm that reached it, and how likely it is to need a replacement, a repair, or wind or hail work. <b>Green</b> is likely, <b>orange</b> is maybe, <b>red</b> is not likely. Each building opens in Street View from the road in front of it, and anything you see on the roof or from the street can overrule the model.',
        meta: ['<b>Imagery</b> Esri World Imagery: Vantor satellite of 31 to 50 cm', '<b>Buildings</b> FEMA USA Structures', '<b>Age</b> the atlas\'s roof age model, the Lafayette and Vermilion parcel rolls, New Orleans and East Baton Rouge permits', '<b>Storms</b> NHC tracks to the ZIP, NOAA hail and wind reports'],
        bar: 'Rooftop Scout', barsub: 'Live: needs the network · street level from zoom ' + CFG.minZoom,
        actions: [{ id: 'scCsv', label: '↓ Buildings CSV', title: 'The buildings in view, with roof, need, evidence and your field checks' }, { id: 'scLinesGo', label: 'Service Lines ↗', title: 'Open the selected ZIP in the Service Lines ledger (module 12)' }, { id: 'scDeskGo', label: 'Campaign Desk ↗', title: 'Send the ZIPs in view to the Campaign Desk' }] }) +
        `<div class="wrap sc">
        ${VIEWER ? callout('', 'This view cannot reach the imagery', 'The Claude viewer blocks requests to outside servers, so the satellite tiles, the buildings and the street links cannot load here. Download this file and open it in Chrome, Edge, Safari or Firefox: everything below then runs live from your browser. The heatmap still draws.') : ''}
        ${callout('note', 'Read this first: what a colour on a roof means', 'Every roof is <b>read by the atlas\'s models, not inspected</b>. The building\'s type, size and height come from FEMA\'s national structure inventory; its age from the Lafayette or Vermilion Parish parcel roll where it carries one, a new construction permit, or else the ZIP\'s housing age; the roof\'s own age from the atlas\'s roof age model (module 17), which wears roofs out on a 22 year life and replaces the share of them each storm took at the ZIP (module 02), and from New Orleans and East Baton Rouge roof permits; recent wind and hail from NOAA\'s reports around the building. That gives the chance of a <b>replacement within five years</b>, a <b>repair call within twelve months</b>, and <b>wind or hail damage</b> still open from the last three years. <span class="sc-sw g" style="vertical-align:-1px"></span> <b>Green</b>: likely to need roof work. <span class="sc-sw o" style="vertical-align:-1px"></span> <b>Orange</b>: maybe. <span class="sc-sw r" style="vertical-align:-1px"></span> <b>Red</b>: not likely (a dashed outline, so the three read apart without colour). Look at the roof and the street, then mark what you saw: your mark replaces the model\'s colour and travels with the CSV.')}
        <div class="kpis" id="scKpis"></div>
        <div class="controls">
          <div class="ctl" style="flex:1 1 300px"><label class="fl" for="scLayer">Heatmap layer</label><select id="scLayer">${layerOptions(Object.keys(LAYERS), CFG.heat)}</select></div>
          <div class="ctl"><label class="fl" for="scOp">Heatmap strength</label><input type="range" id="scOp" min="0" max="0.9" step="0.05" value="${CFG.opacity}"></div>
          <div class="ctl"><label class="fl" for="scImg">Imagery</label><select id="scImg"><option value="esri">Satellite</option><option value="esri-labels">Satellite with street names</option><option value="street">Street map</option></select></div>
          <div class="ctl" style="flex:1 1 260px"><label class="fl" for="scFind">Find an address, ZIP, city or parish</label><form id="scFindF" autocomplete="off"><input type="search" id="scFind" placeholder="632 Woodgate Blvd, Baton Rouge · 70119 · Lafayette · Calcasieu"></form></div>
        </div>
        <div class="sc-grid">
          <div class="card sc-mapcard"><div class="sc-modebar"><div class="seg" id="scMode" role="group" aria-label="What the card shows"><button type="button" data-v="map" aria-pressed="true">Satellite</button><button type="button" data-v="3d" aria-pressed="false">Street view (3D)</button><button type="button" data-v="sv" aria-pressed="false">Google photos</button></div><span class="sc-mnote" id="scModeNote">Pick a building, then Street view to stand in the street in front of it (or double click the building).</span></div>
            <div class="sc-map" id="scMap" role="application" aria-label="Satellite map of Louisiana with the heatmap and buildings"></div>
            <div class="sc-svw" id="scSvw" hidden><div class="sc-svbar" id="scSvBar"></div><div class="sc-svj" id="scSvJ" hidden><div class="sc-svp" id="scSvP"></div><canvas class="sc-svc" id="scSvC" aria-hidden="true"></canvas></div><iframe class="sc-svf" id="scSvF" title="Google Street View" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="about:blank"></iframe></div>
            <div class="sc-3dw" id="sc3dW" hidden><div class="sc-svbar" id="sc3dBar"></div><div class="sc-3d" id="sc3D"><div class="sc-3dnote" id="sc3dNote"></div><div class="sc-3dpad" id="sc3dPad" role="group" aria-label="Walk and turn"><span></span><button type="button" data-k="fwd" title="Walk forward (W)" aria-label="Walk forward">▲</button><span></span><button type="button" data-k="left" title="Turn left (A)" aria-label="Turn left">◀</button><button type="button" data-k="back" title="Walk back (S)" aria-label="Walk back">▼</button><button type="button" data-k="right" title="Turn right (D)" aria-label="Turn right">▶</button></div><div class="sc-3dattr">Imagery: Esri, Vantor · Buildings: FEMA · Streets: © OpenStreetMap contributors, U.S. Census</div></div></div>
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
          ${card('How a roof is read', 'Each step named with its source and grade. Every number on a building card comes from them.', '<ol class="meth" id="scMeth"></ol>')}
          ${card('Settings and keys', 'Kept in this browser only. Nothing here is required: the imagery, buildings and Street View links work without any key.', '<div class="sc-form" id="scSet"></div>')}
        </div>
        <div class="split">
          ${card('Caveats: the fine print', 'What would change a colour on a roof.', '<div id="scCav"></div>')}
          ${card('What this cannot show', 'Gaps, and where the missing record lives.', '<div id="scGap"></div>')}
        </div>
        ${card('Source register', 'Every layer traced to the service it came from, with the grade the atlas applies.', '<div id="scSrc"></div>', 'mt')}
        <div class="foot">Rooftop Scout reads public records and models them. It does not inspect roofs, and a colour is a probability, not a finding about a household. The requests go from this browser to Esri, FEMA, the Census Bureau, the City of New Orleans and East Baton Rouge Parish open data portals, the Lafayette and Vermilion parcel layer on ArcGIS Online, the public Overpass API servers that serve OpenStreetMap data for the 3D streets (overpass-api.de, run by FOSSGIS, then Kumi Systems' overpass.kumi.systems and VK's maps.mail.ru when it does not answer), Hugging Face and jsDelivr (once, for the AI model that traces the 3D view and its runtime), the USGS elevation service (for the photoreal view's ground), Google (for its Street View photos, while they show, and with your key its photoreal 3D tiles from tile.googleapis.com) and, with a token, Mapillary. Each request carries only the area or point in view, or the address you type in the search box (and, like any web request, this computer's network address). The AI detail and the AI tracing run on this computer and send nothing; what the module keeps (the last view, your field checks and notes) stays in this browser, and a key goes only to its own service. Street View is Google's own player, loaded from google.com while it shows. Building level readings are for planning field visits: under the atlas's compliance rules (module 02, What never to publish; modules 05 and 08 target ZIPs, never single homes) a specific damaged home's address, photo or owner never goes into an ad, a page or a post without written permission.</div>
        </div>`;

      $('#scImg', root).value = CFG.imagery;
      const host = $('#scMap', root);
      if (!LF) { host.innerHTML = '<div class="callout" style="margin:16px">The map library did not load, so the map cannot draw. Reload the page.</div>'; return; }

      /* ---------- the map ---------- */
      const map = LF.map(host, { minZoom: 7, maxZoom: 22, zoomSnap: 1, worldCopyJump: false, attributionControl: true, preferCanvas: false, maxBounds: [[28.3, -95.4], [33.7, -88.0]], maxBoundsViscosity: 0.6 });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      LF.control.scale({ imperial: true, metric: false, position: 'bottomleft' }).addTo(map);
      [['scHeat', 410], ['scCty', 415], ['scRef', 420], ['scBld', 430], ['scSel', 440]].forEach(([n, z]) => { const p = map.createPane(n); p.style.zIndex = z; if (n === 'scRef' || n === 'scCty') p.style.pointerEvents = 'none'; });
      const hint = LF.control({ position: 'topright' }); hint.onAdd = () => { const d = LF.DomUtil.create('div', 'sc-hint'); d.id = 'scHint'; return d; }; hint.addTo(map);
      const bR = LF.canvas({ pane: 'scBld', padding: 0.4, tolerance: 3 });
      const gB = LF.layerGroup().addTo(map), gSel = LF.layerGroup().addTo(map);
      const COL = { g: cssv('--sc-g') || '#1fbf4c', o: cssv('--sc-o') || '#ff9f1a', r: cssv('--sc-r') || '#f04438' };

      /* base imagery */
      let base = [], cm15 = null, fineRes = null, tileErr = 0, tileOk = 0;
      const esriAttr = 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>. Imagery: Esri, Vantor, Earthstar Geographics and the GIS user community';
      function setBase() {
        base.forEach(l => map.removeLayer(l)); base = [];
        const root0 = CFG.arcgisKey ? EP.esriKey : EP.esri, tok = CFG.arcgisKey ? '?token=' + encodeURIComponent(CFG.arcgisKey) : '';
        const tl = (svc, o) => LF.tileLayer(root0 + svc + '/MapServer/tile/{z}/{y}/{x}' + tok, Object.assign({ maxZoom: 22, maxNativeZoom: 19, attribution: esriAttr, detectRetina: false }, o || {}));
        if (CFG.imagery === 'street') base.push(tl('World_Street_Map', { maxNativeZoom: 19, attribution: 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>. Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, © OpenStreetMap contributors, and the GIS User Community' }));
        else {
          base.push(tl('World_Imagery', { maxNativeZoom: cm15 === true ? 20 : 19 }));
          if (CFG.imagery === 'esri-labels') { base.push(tl('Reference/World_Transportation', { pane: 'scRef', maxNativeZoom: 19, attribution: 'Labels: Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community' })); base.push(tl('Reference/World_Boundaries_and_Places', { pane: 'scRef', maxNativeZoom: 19, attribution: '' })); }
        }
        base.forEach((l, i) => { l.on('tileerror', () => { tileErr++; if (tileErr > 6 && !tileOk) status(); }); l.on('tileload', () => { tileOk++; }); l.addTo(map); if (i === 0) l.bringToBack(); });
        aiSet();
      }

      /* ---------- AI detail: past the imagery's finest zoom, Real-ESRGAN draws each tile four times finer ---------- */
      /* The imagery stops at zoom 19 across Louisiana (about 26 cm a screen pixel here: Esri has no 15 cm layer in the state,
         and its zoom 20 tile reads "Map data not yet available"), from Vantor captures of 31 to 50 cm; zoom 20 only where a
         15 cm layer turns up under the map. Closer than that the map would only enlarge pixels; with AI detail on, each tile
         from the zoom after it to 22 is cut from its parent run through
         Real-ESRGAN (scoutsr.js, on this computer's graphics card), with a 16 pixel margin from the neighbours so no seams
         show. A tile first shows the plain enlargement, then the enhanced one. Parents are kept (24 of them), so panning back
         costs nothing. The detail is inferred, not photographed: the map labels it whenever it shows. */
      const AI = { cache: new Map(), queue: [], running: false, done: 0, ms: 0, err: '', layer: null, ctl: null };
      const aiAvail = () => !!(window.__SCOUT_SR__ && window.__SCOUT_TF__);
      const aiOn = () => CFG.ai !== false && aiAvail() && CFG.imagery !== 'street';
      const imgURL = (z, x, y) => (CFG.arcgisKey ? EP.esriKey : EP.esri) + 'World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x + (CFG.arcgisKey ? '?token=' + encodeURIComponent(CFG.arcgisKey) : '');
      const loadImg = url => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile')); im.src = url; });
      const aiPz = () => (cm15 === true ? 20 : 19);
      function aiParent(pz, px, py) {
        const key = pz + '/' + px + '/' + py; let e = AI.cache.get(key);
        if (e) { AI.cache.delete(key); AI.cache.set(key, e); e.refs++; return e; }
        e = { key, pz, px, py, refs: 1 }; e.p = new Promise((res, rej) => { e.res = res; e.rej = rej; }); e.p.catch(() => {});
        AI.cache.set(key, e); AI.queue.push(e); while (AI.cache.size > 16) { const k0 = AI.cache.keys().next().value; const o = AI.cache.get(k0); AI.cache.delete(k0); const qi = AI.queue.indexOf(o); if (qi >= 0) { AI.queue.splice(qi, 1); o.rej(new Error('dropped')); } }
        setTimeout(aiPump, 0); return e;   /* after the whole batch of tiles is queued, so the nearest goes first */
      }
      async function aiPump() {
        if (AI.running) return; AI.running = true; aiPaint();
        try {
          while (AI.queue.length) {
            const c = map.getCenter(), z = AI.queue[0].pz, n2 = Math.pow(2, z), cx = (c.lng + 180) / 360 * n2, cy = (1 - Math.log(Math.tan(rad(c.lat)) + 1 / Math.cos(rad(c.lat))) / Math.PI) / 2 * n2;
            AI.queue.sort((a, b) => Math.hypot(a.px + 0.5 - cx, a.py + 0.5 - cy) - Math.hypot(b.px + 0.5 - cx, b.py + 0.5 - cy));
            const e = AI.queue.shift();
            if (e.refs <= 0) { AI.cache.delete(e.key); e.rej(new Error('dropped')); continue; }
            aiPaint();
            try {
              const m = 16, cv = document.createElement('canvas'); cv.width = cv.height = 256 + 2 * m; const g = cv.getContext('2d');
              const ims = await Promise.all([-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => loadImg(imgURL(e.pz, e.px + dx, e.py + dy)).catch(() => null))));
              if (!ims[4]) throw new Error('the imagery tile did not load');
              g.drawImage(ims[4], m - 256, m - 256, 768, 768);   /* a stretched fill under the edges, in case a neighbour is missing */
              ims.forEach((im, i) => { if (im) g.drawImage(im, m + (i % 3 - 1) * 256, m + (Math.floor(i / 3) - 1) * 256); });
              const big = await window.__SCOUT_SR__.enhance(cv), out = document.createElement('canvas'); out.width = out.height = 1024;
              out.getContext('2d').drawImage(big, 4 * m, 4 * m, 1024, 1024, 0, 0, 1024, 1024);
              AI.done++; AI.ms = window.__SCOUT_SR__.enhance.lastMs || 0; AI.err = ''; e.res(out);
            } catch (err) { AI.err = String((err && err.message) || err); e.rej(err); AI.cache.delete(e.key); }
            aiPaint();
          }
        } finally { AI.running = false; aiPaint(); }
      }
      const AILayer = LF.GridLayer.extend({
        initialize(o) { LF.GridLayer.prototype.initialize.call(this, o); this.on('tileunload', ev => { const e = ev.tile && ev.tile._aiE; if (e) { e.refs--; ev.tile._aiE = null; } }); },
        createTile(coords, done) {
          const pz = aiPz(), dz = coords.z - pz, n = 1 << Math.max(0, dz), t = document.createElement('canvas');
          /* on a high density screen the tile keeps all the pixels the network drew (512 a tile one zoom past the parent), shown at 256 */
          const R = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1))), W = Math.max(256, Math.min(256 * R, 1024 / n));
          t.width = t.height = W; const g = t.getContext('2d');
          if (dz < 1) { setTimeout(() => done(null, t), 0); return t; }
          const px = coords.x >> dz, py = coords.y >> dz, sx = coords.x - px * n, sy = coords.y - py * n;
          loadImg(imgURL(pz, px, py)).then(im => { if (!t.dataset.ai) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, sx * 256 / n, sy * 256 / n, 256 / n, 256 / n, 0, 0, W, W); } done(null, t); }).catch(() => done(null, t));
          const e = aiParent(pz, px, py); t._aiE = e;   /* the tile holds a reference until it unloads */
          e.p.then(c => { const s2 = 1024 / n; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, sx * s2, sy * s2, s2, s2, 0, 0, W, W); t.dataset.ai = '1'; }).catch(() => {});
          return t;
        },
      });
      const AICtl = LF.Control.extend({ options: { position: 'bottomleft' }, onAdd() { const d = LF.DomUtil.create('div', 'sc-aictl'); LF.DomEvent.disableClickPropagation(d); LF.DomEvent.disableScrollPropagation(d); return d; } });
      function aiPaint() {
        if (!AI.ctl) return; const d = AI.ctl.getContainer(); if (!d) return;
        if (!aiAvail() || CFG.imagery === 'street') { d.hidden = true; return; } d.hidden = false;
        const z = map.getZoom(), past = z > aiPz(), on = aiOn(), left = AI.queue.length + (AI.running ? 1 : 0);
        const st = !on ? 'off' : !past ? `on from zoom ${aiPz() + 1}` : AI.err && !left ? 'not available here: ' + esc(AI.err) : left ? `enhancing ${left} tile${left > 1 ? 's' : ''}${AI.ms ? ' (' + (AI.ms / 1000).toFixed(1) + ' s each)' : ''}…` : 'enhanced';
        d.innerHTML = `<button type="button" aria-pressed="${on}" title="Past the imagery's finest zoom, Real-ESRGAN (an AI model running on this computer) draws each tile four times finer">AI detail: ${on ? 'On' : 'Off'}</button><span>${st}</span>${on && past ? `<em>AI enhanced beyond the imagery${fineRes ? '\'s ' + Math.round(fineRes * 100) + ' cm' : '\'s finest detail'}: fine detail is inferred, not photographed</em>` : ''}`;
        d.querySelector('button').onclick = () => { CFG.ai = !aiOn(); saveCfg(); aiSet(); };
      }
      function aiSet() {
        if (AI.layer) { map.removeLayer(AI.layer); AI.layer = null; }
        if (aiOn()) { AI.layer = new AILayer({ minZoom: aiPz() + 1, maxZoom: 22, tileSize: 256, zIndex: 5, updateWhenZooming: false, keepBuffer: 1 }); AI.layer.addTo(map); }
        /* while the page is still loading, the AI code has not run yet: keep zoom 22 open until the hook below decides */
        const z22 = aiOn() || (CFG.ai !== false && CFG.imagery !== 'street' && !aiAvail() && document.readyState === 'loading');
        map.setMaxZoom(z22 ? 22 : 21); if (!z22 && map.getZoom() > 21) map.setZoom(21);
        if (!AI.ctl && aiAvail()) { AI.ctl = new AICtl(); AI.ctl.addTo(map); map.on('zoomend', aiPaint); }
        aiPaint();
      }
      setBase();
      /* the AI and 3D code sits at the end of the page, after the shell has drawn the first module: opened straight on this
         tab, the module mounts before it has run, so AI detail is set up again once the page has finished loading */
      if (!aiAvail() && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aiSet, { once: true });

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
          poly.setStyle({ fillColor: c || '#000', fillOpacity: c ? fo : 0, color: isSel ? cssv('--accent') || '#b0502a' : '#ffffff', weight: isSel ? 3 : zm >= 15 ? 1.2 : 0.8, opacity: isSel ? 1 : zm >= 17 ? 0.35 : 0.6 }); if (isSel) poly.bringToFront(); });
        cty.eachLayer(l => l.setStyle({ opacity: zm >= 15 ? 0 : 0.8 }));
        const v = ZR.map(z => z[CFG.heat]).filter(isN);
        $('#scLeg', root).innerHTML = legendHTML({ title: 'Heatmap: ' + L.l, R: sc.R, lo: L.f(Math.min(...v)), hi: L.f(Math.max(...v)), note: `${G(L.g)} ${esc(L.note)} The heatmap fades as you zoom in so the roofs show; set its strength above.` }) +
          `<div><div class="lt">Roofs, from street level</div><div class="sc-chips"><span class="sc-chip" style="cursor:default"><span class="sc-sw g"></span>Likely needs roof work</span><span class="sc-chip" style="cursor:default"><span class="sc-sw o"></span>Maybe</span><span class="sc-chip" style="cursor:default"><span class="sc-sw r"></span>Not likely</span></div></div>`;
      }

      /* ---------- buildings on the map ---------- */
      var sel = null, hov = null;
      const shown = b => CFG.show[b.status] && (CFG.kind === 'all' || (PROF[b.cls] || PROF.unk).kind === CFG.kind);
      function bStyle(b) {
        /* the fill thins as the roofs come up, so the roof itself stays visible at the closest zoom; the outline carries the colour */
        const s = b.status, c = COL[s], isSel = sel && sel.type === 'b' && sel.id === b.id, zm = map.getZoom(), h = hov === b.id, fill = zm <= 17 ? 0.38 : zm === 18 ? 0.28 : zm === 19 ? 0.15 : 0.05;
        return { color: isSel ? '#ffffff' : c, weight: (isSel ? 3.5 : zm >= 19 ? 2.4 : 1.6) + (h ? 1.2 : 0) + (b.checked && !isSel ? 0.8 : 0), opacity: 1, fillColor: c, fillOpacity: isSel ? Math.min(0.12, fill) : s === 'r' ? fill * 0.4 : fill, dashArray: s === 'r' && !isSel ? (zm >= 19 ? '7 5' : '4 3') : null, renderer: bR, pane: 'scBld' };
      }
      function draw(b) {
        if (!b.lay) { b.lay = LF.polygon(b.rings, bStyle(b)); b.lay.on('click', e => { LF.DomEvent.stopPropagation(e); pick(b.id); });
          b.lay.on('dblclick', e => { LF.DomEvent.stop(e); hideTip(); pick(b.id); open3D({ lat: b.lat, lon: b.lon, street: b.street, b }); });
          b.lay.on('mouseover', e => { hov = b.id; b.lay.setStyle(bStyle(b)); showTip(bTip(b), e.originalEvent); }); b.lay.on('mousemove', e => showTip(bTip(b), e.originalEvent)); b.lay.on('mouseout', () => { hov = null; b.lay.setStyle(bStyle(b)); hideTip(); }); }
        else b.lay.setStyle(bStyle(b));
        const on = shown(b) && map.getZoom() >= CFG.minZoom - 1; if (on && !gB.hasLayer(b.lay)) gB.addLayer(b.lay); else if (!on && gB.hasLayer(b.lay)) gB.removeLayer(b.lay);
        if (d3Mode) refresh3D();
      }
      const bTip = b => `<div class="tt">${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</div><div class="ts">${esc((PROF[b.cls] || PROF.unk).l)}${b.zip ? ' · ' + esc(b.zip) : ''}</div>` + tipRow('Status', esc(STL[b.status]) + (b.checked ? ' (your check)' : '')) + tipRow('Score', String(b.sc.score)) + tipRow('Likely roof', esc(b.roof.short)) + tipRow('Need', esc(needLabel(b).split(':')[0])) + tipRow('Roof age (model)', b.roof.keys && b.roof.keys.length ? 'about ' + D(b.state.age, 0) + ' years' : '—') + tipRow('Year built', b.yb ? String(b.yb) : 'not on file') + (b.last ? tipRow('Last roof permit', esc(monthYear(b.last.d))) : '') + '<div class="tf">Click for the full reading · double click for Street View</div>';
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
        const wantParcels = fips.some(f => PCOV[f] === 'yes');
        const jobs = [];
        if (wantParcels) jobs.push(fetchParcels(t.box, 0).then(ps => joinParcels(t, ps)).catch(e => note('Parcels: ' + why(e))));
        if (fips.some(f => PFILE[f])) jobs.push(fetchPermits(t).then(pr => { t.permitRes = pr; pr.errs.forEach(note); t.permitsAsked = pr.asked; }).catch(e => note('Permits: ' + why(e))));
        await Promise.all(jobs);
        if (t.permitRes) { joinPermits(t, t.permitRes); t.permitRes = null; }
        t.ids.forEach(id => { const b = B.get(id); if (b) { read(b); draw(b); } });
        t.st = 'ok'; t.force = false; refreshSoon(); tryPending(); if (svMode) drawSoon(); if (d3Mode) refresh3D();
        if (sel && sel.type === 'b' && t.ids.has(sel.id)) detail();
      }
      function evict() {
        const ok = [...T.values()].filter(t => t.st === 'ok' || t.st === 'err').sort((a, b) => a.at - b.at); if (ok.length <= 70) return;
        ok.slice(0, ok.length - 70).forEach(t => { if (inView(t)) return; t.ids.forEach(id => { const b = B.get(id); if (!b) return; b.tiles.delete(t.k); if (!b.tiles.size && !(sel && sel.id === id)) { if (b.lay) gB.removeLayer(b.lay); B.delete(id); } }); t.ids.clear(); t.st = 'idle'; t.roads = null; });
      }
      function note(msg) { errors.push(msg); errors = errors.slice(-6); status(); }

      /* ---------- the status line, counts and table ---------- */
      /* the view the counts, the table and the CSV read: the map's, or while Street View hides the map, the last one it showed */
      let viewBounds = null; const curBounds = () => ((svMode || d3Mode) && viewBounds ? viewBounds : map.getBounds());
      const inViewB = () => { const bd = curBounds(); return [...B.values()].filter(b => bd.contains([b.lat, b.lon])); };
      function status() {
        const zm = map.getZoom(), busy = Q.run + Q.list.length, el2 = $('#scStatus', root), hintEl = document.getElementById('scHint'); if (!el2) return;
        const bs = zm >= CFG.minZoom ? inViewB() : [];
        let s = '';
        if (VIEWER) s = 'The viewer blocks outside requests: download the file to see imagery and buildings.';
        else if (tileErr > 6 && !tileOk) s = `<b>The imagery is not loading.</b> Check the connection${CFG.arcgisKey ? ' and the ArcGIS key in Settings' : ''}.`;
        else if (zm < CFG.minZoom) s = `Zoom ${zm}. Buildings appear from zoom ${CFG.minZoom} (street level). Click a ZIP to fly to it.`;
        else s = `${busy ? '<span class="sc-busy"></span>Reading buildings… ' : ''}<b>${N(bs.length)}</b> buildings in view${fineRes ? ' · ' + Math.round(fineRes * 100) + ' cm imagery at the closest zoom' : ''}${errors.length ? ` · <span title="${esc(errors.join('\n'))}">${N(errors.length)} source${errors.length === 1 ? '' : 's'} did not answer</span>` : ''}`;
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
        const withYb = all.filter(b => b.ybSrc === 'parcel' || b.ybSrc === 'permit').length, withP = all.filter(b => b.permits.some(p => p.kind !== 'newc' && p.w >= 0.3)).length, checks = all.filter(b => b.checked).length;
        $('#scKpis', root).innerHTML = kpiHTML([
          { l: 'Buildings in view', v: zm >= CFG.minZoom ? N(all.length) : '—', d: zm >= CFG.minZoom ? `${N(bs.length)} shown by the filters` : `zoom ${CFG.minZoom} or closer` },
          { l: 'Likely needs roof work', v: N(cnt.g), d: all.length ? `${pct(cnt.g / all.length)} of the buildings in view` : 'green on the map' },
          { l: 'Maybe', v: N(cnt.o), d: all.length ? `${pct(cnt.o / all.length)} of the buildings in view` : 'orange on the map' },
          { l: 'Not likely', v: N(cnt.r), d: all.length ? `${pct(cnt.r / all.length)} of the buildings in view` : 'red, dashed' },
          { l: 'Year built on file', v: all.length ? pct(withYb / all.length) : '—', d: 'Lafayette or Vermilion parcel roll, or a new construction permit' },
          { l: 'Roof permits found', v: N(withP), d: 'buildings with a New Orleans or East Baton Rouge roof permit' },
          { l: 'Field checks', v: N(checks), d: `in view; ${N(Object.keys(CK).length)} saved in this browser` },
        ]);
        const tbl = $('#scTbl', root);
        if (!bs.length) { tbl.innerHTML = `<p class="sc-empty" style="padding:14px 16px">${zm < CFG.minZoom ? `Zoom to street level (${CFG.minZoom} or closer) to list the buildings in view.` : all.length ? 'The filters hide every building in view.' : 'No buildings read here yet.'}</p>`; $('#scTblSub', root).textContent = 'Zoom to street level to list them. Click a row to select it, a header to sort.'; return; }
        $('#scTblSub', root).textContent = `${N(bs.length)} in view${bs.length > 400 ? ', the 400 with the highest scores listed' : ''}. Click a row to select it, a header to sort.`;
        const rank = { g: 3, o: 2, r: 1 }, rows = bs.slice().sort((a, b) => b.sc.score - a.sc.score).slice(0, 400);
        dataTable(tbl, [
          { k: 'st', h: 'Status', l: 1, v: r => rank[r.status] * 1000 + r.sc.score, f: (v, r) => `<span class="sc-tdot ${r.status}"></span>${STS[r.status]}${r.checked ? ' ✓' : ''}` },
          { k: 'score', h: 'Score', v: r => r.sc.score, f: v => N(v), t: 'Chance of at least one paid roofing job (percent): a replacement within five years, a repair call within twelve months, or wind or hail work' },
          { k: 'addr', h: 'Address', l: 1, cls: 'sc-a', v: r => r.addr ? title(r.addr) : '', f: (v, r) => v ? esc(v) + (r.zip ? ` <span class="mini">${esc(r.zip)}</span>` : '') : '<span class="mini">no address on file</span>' },
          { k: 'use', h: 'Use', l: 1, v: r => (PROF[r.cls] || PROF.unk).l, f: v => esc(v) },
          { k: 'roof', h: 'Likely roof', l: 1, cls: 'sc-w', v: r => r.roof.short, f: v => esc(v) },
          { k: 'need', h: 'Likely need', l: 1, cls: 'sc-w', v: r => needLabel(r), f: v => esc(v) },
          { k: 'age', h: 'Roof age', v: r => r.roof.keys && r.roof.keys.length ? r.state.age : null, f: (v, r) => isN(v) && r.roof.keys && r.roof.keys.length ? `<span title="Mean roof age from the model">~${D(v, 0)}</span>` : '—', t: 'The model\'s mean roof age in years: the year built, the roof life, the storms that reached the ZIP and any roof permit' },
          { k: 'yb', h: 'Built', v: r => r.yb || r.ybMid || null, f: (v, r) => r.yb ? String(r.yb) : r.ybMid ? `<span class="mini" title="Estimated from the ZIP's housing age">~${Math.round(r.ybMid / 10) * 10}s</span>` : '—' },
          { k: 'perm', h: 'Last roof permit', v: r => r.last ? r.last.y : null, f: (v, r) => r.last ? esc(monthYear(r.last.d)) : '—' },
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
        detail(); street(t); if (d3Mode) { if (o && o.noSV) { d3Target = t; if (d3) d3.setCurrent(b.id); render3DBar(); } else open3D(t); } else if (svMode) { if (o && o.noSV) { svTarget = t; renderSvBar(); drawSoon(); } else showSV(t); } refreshSoon();
      }
      function pickPoint(la, lo) {
        const prev = sel && sel.type === 'b' ? B.get(sel.id) : null; sel = { type: 'pt', lat: la, lon: lo }; if (prev && prev.lay) prev.lay.setStyle(bStyle(prev));
        const t = { lat: la, lon: lo, street: '', b: null };
        detail(); street(t); if (d3Mode) open3D(t); else if (svMode) showSV(t); refreshSoon();
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
        if (!sel) { nm.textContent = 'Pick a place'; sb.textContent = 'Click an area of the heatmap, or search an address'; pl.innerHTML = ''; dt.innerHTML = `<p class="sc-empty">Start on the heatmap: the darker ZIPs carry the most roof demand on the layer you choose. Click one to fly in; from zoom ${CFG.minZoom} every building in view is read and coloured. Or type an address above to go straight to a roof.</p>${zipList()}`; wireZipList(); return; }
        if (sel.type === 'zip') {
          const z = ZI[sel.zip]; nm.textContent = z ? `${z.zip} · ${z.city}` : sel.zip; sb.textContent = z ? `${z.cty} Parish · ${N(z.hu)} homes · median year built ${D(z.yb_med, 0)}` : ''; pl.innerHTML = z && isN(z.idx) ? `<span class="pill">Index ${D(z.idx, 0)}</span>` : '';
          dt.innerHTML = z ? `<div class="rowl"><span>Roof Demand Index (percentile)</span><b>${D(z.idx, 0)}</b></div><div class="rowl"><span>Roofs 20 years or older (model)</span><b>${P(z.ra20_sh, 0)}</b></div><div class="rowl"><span>Roofs aged 15 to 19, the next wave</span><b>${N(z.wave)}</b></div><div class="rowl"><span>Median roof age (model)</span><b>${isN(z.ra_med) ? D(z.ra_med, 0) + ' years' : '—'}</b></div><div class="rowl"><span>Last hurricane force winds</span><b>${z.last64 ? esc(z.last64) : 'none since 1950'}</b></div><div class="rowl"><span>Hail days a year, 1 inch or larger within 25 miles</span><b>${D(z.hd1, 1)}</b></div><div class="rowl"><span>FEMA roof and wind registrations, 2004 to 2026</span><b>${N(z.fema_k)}</b></div><div class="rowl"><span>Age driven replacements, next twelve months</span><b>${N(z.nxt)}</b></div>
            <p class="mini" style="margin-top:10px">Zoom to street level (${CFG.minZoom}) inside the ZIP and every roof is read with these figures as its starting point.</p><div class="sc-acts"><button class="btn sm" id="scZin">Zoom to street level</button><button class="btn sm sec" id="scIdx">Roof Demand Index ↗</button><button class="btn sm sec" id="scStock">Roof Stock ↗</button></div>` : '';
          const zin = $('#scZin', root); if (zin) zin.onclick = () => { const p = ZPI[sel.zip]; const c = LF.latLngBounds(p.rings.flat()).getCenter(); map.setView(c, CFG.minZoom); };
          const sk = $('#scStock', root); if (sk) sk.onclick = () => goModule('stock', { zip: sel.zip }); const si = $('#scIdx', root); if (si) si.onclick = () => goModule('index', { zip: sel.zip });
          return;
        }
        if (sel.type === 'pt') { nm.textContent = 'A point on the map'; sb.textContent = `${sel.lat.toFixed(5)}, ${sel.lon.toFixed(5)}${zipAt(sel.lat, sel.lon) ? ' · ZIP ' + zipAt(sel.lat, sel.lon) : ''}`; pl.innerHTML = ''; dt.innerHTML = `<p class="sc-empty">No building is selected. Click a coloured roof to read it${map.getZoom() < CFG.minZoom ? `, after zooming to ${CFG.minZoom} or closer` : ''}. Street View for this point is beside.</p>`; return; }
        const b = B.get(sel.id); if (!b) return; const s = b.sc, st = b.state, rf = b.roof, ck = CK[b.id] || {}, z = b.z, hasRoof = !!(rf.keys && rf.keys.length);
        nm.textContent = b.addr ? title(b.addr) : 'Building, no address on file';
        sb.textContent = [b.city ? title(b.city) : (z ? z.city : ''), b.zip, (PROF[b.cls] || PROF.unk).l, b.sqft ? N(Math.round(b.sqft / 10) * 10) + ' sq ft footprint' : '', b.h ? D(b.h, 1) + ' m tall' : ''].filter(Boolean).join(' · ');
        pl.innerHTML = `<div class="sc-score">${N(s.score)}<small>score</small></div><button type="button" class="btn sm sc-svq" id="scSvQ" title="Stand in the street in front of this building">Street view</button>`;
        $('#scSvQ', pl).onclick = () => { open3D({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        const roll = b.parcel && b.parcel.parish ? b.parcel.parish + ' Parish' : (PNAME(b.fips) ? PNAME(b.fips) + ' Parish' : 'the parish');
        const ybTxt = b.ybSrc === 'parcel' ? `<b>Built ${b.yb}</b>, from the ${esc(roll)} tax roll in the public parcel layer${b.parcel && b.parcel.tax ? ' (tax year ' + esc(b.parcel.tax) + ')' : ''} ${G('A')}`
          : b.ybSrc === 'permit' ? `<b>Built about ${b.yb}</b>, from a new construction permit (${esc((b.permits.find(p => p.kind === 'newc') || {}).src || 'city')}) ${G('A')}`
          : `<b>Year built not on file</b>${b.parcel && !b.parcel.yb ? ` (its parcel on the ${esc(roll)} roll carries none)` : ''}. Most likely ${b.prior ? b.prior.map((w, i) => [w, i]).sort((x, y) => y[0] - x[0]).slice(0, 2).map(([w, i]) => `${BIN_L[i]} (${pct(w)})`).join(' or ') : 'unknown'}, from the ZIP's housing age${b.cls === 'sf' ? ' and the footprint' : ''} ${G('C')}`;
        const pm = b.permits.filter(p => p.kind !== 'newc' && p.w >= 0.15).slice(0, 4), file = PFILE[b.fips];
        const nUsed = b.permits.filter(p => p.kind !== 'newc' && p.w >= 0.3).length;
        const permTxt = pm.length ? pm.map(p => `<b>${p.kind === 'reroof' ? 'Reroof permit' : p.kind === 'mh' ? 'Manufactured home placed' : 'Permit with roof work'} ${esc(monthYear(p.d))}</b>: ${esc(String(p.desc).slice(0, 110) || p.type)} (${p.addr ? esc(title(String(p.addr).replace(/\s+(BATON ROUGE|NEW ORLEANS)\s+LA\b.*$/i, ''))) + ', ' : ''}${esc(p.src)}${p.share < 1 ? '; an address shared with other buildings' : ''})${p.w < 0.3 ? ' (not used by the model: it reads no reroof or repair of the main roof in the text)' : ''} ${G('A')}`).join('</li><li>') + (b.last ? `</li><li>The model reads the ${esc(monthYear(b.last.d))} permit as ${b.last.kind === 'mh' ? 'the placement of a new or used home' : b.last.w >= 0.9 ? 'a reroof' : b.last.w >= 0.6 ? 'most likely a reroof' : b.last.w >= 0.4 ? 'a repair or a partial reroof' : 'a roof repair'}${b.last.share < 1 ? ' on one or more of the buildings at its address' : ''} and restarts the roof's clock there (weight ${pct(b.lastW)}${b.last.share < 1 ? ` for this building, ${pct(b.last.w)} for the permit` : ''})${nUsed > 1 ? ', after the older ones at their own weights' : ''}.` : '')
          : file ? `<b>No roof permit on file</b> at this building (${file === 'nola' ? 'City of New Orleans: reroof permits from May 2025, roof work in renovation permits from 2012' : 'East Baton Rouge Parish: reroof permits from July 2025, roof work in remodel permits from 2012, with map points mostly from 2016'}). A reroof has needed a permit since August 1, 2025 (Act 239), but most older reroofs left no permit on file, so this is weak evidence for an older roof ${G('B')}` : 'No roof permit file covers this address in the atlas (New Orleans and East Baton Rouge Parish only).';
        const mix = rf.mix ? `<div class="sc-sub">Odds by covering: ${rf.mix.map(([l, p]) => `${esc(l)} ${pct(p)}`).join(' · ')} ${G('D')}</div>` : '';
        const ctx = z ? `<b>ZIP ${esc(z.zip)}</b>: Roof Demand Index ${D(z.idx, 0)}, ${P(z.ra20_sh, 0)} of roofs 20 or older, last hurricane force winds ${z.last64 ? esc(z.last64) : 'none since 1950'}, ${D(z.hd1, 1)} hail days a year within 25 miles ${G('B')}` : '';
        const resets = stormsAt(b.zip).filter(x => x.d >= 0.02 && x.list.length).sort((a, c) => c.d - a.d).slice(0, 3);
        const resetTxt = resets.length ? `<b>Storms that replaced roofs here</b>: ${resets.map(x => `${esc(stormName(x.list[0].s))}, about ${ktMph0(x.list[0].kt)} mph modeled, ${pct(x.d)} of the ZIP's one unit roofs`).join('; ')} (module 17) ${G('B')}` : '';
        const evSeen = new Set(), evs = (b.ev || []).filter(e => { const k = evLabel(e) + '|' + D(e.km, 1) + '|' + evWhen(e); if (evSeen.has(k)) return false; evSeen.add(k); return true; }).slice(0, 4), evTxt = evs.length ? `<b>NOAA reports within 5 km, last three years</b>: ${evs.map(e => `${esc(evLabel(e))}, ${D(e.km, 1)} km ${esc(e.dir)}, ${esc(evWhen(e))}`).join('; ')} ${G('A')}` : '<b>No damaging hail, wind or tornado report</b> within 5 km in the last three years (NOAA Storm Events) ' + G('A');
        const topS = st.storms && st.storms[0] ? st.storms[0] : null;
        dt.innerHTML = `<div class="sc-sec"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="sc-pill ${b.status}">${STL[b.status]}</span>${b.checked && ck.s ? '<span class="pill">your field check</span>' : ''}</div><div class="sc-sys" style="margin-top:8px">${esc(needLabel(b))}</div></div>
          <div class="sc-sec"><p class="sc-k">Likely roof</p><div class="sc-sys">${esc(rf.name)}</div>${rf.size ? `<div class="sc-sub">${esc(rf.size)}</div>` : ''}${mix}<div class="sc-sub"><b>What a roofer checks:</b> ${esc(rf.check)}</div></div>
          <div class="sc-sec"><p class="sc-k">Chance of the work ${G('B')}</p><div class="sc-bars">${bar('Replacement within 5 years', s.P5, 'From the roof life, given the age evidence below: the roof wearing out, not a new storm')}${bar('Repair call within 12 months', s.REP, 'Leak and repair calls by roof age, scaled to the atlas\'s repair line')}${bar('Wind damage still open', s.WIND, 'Hurricanes and tropical storms at the ZIP, thunderstorm wind and tornado reports nearby, in the last three years; less where a reroof permit followed')}${bar('Hail damage still open', s.HAIL, 'Hail of an inch or more reported within 5 km in the last three years; less where a reroof permit followed')}</div>
            <div class="sc-sub" style="margin-top:6px">${!hasRoof ? '' : `${b.strong ? `Still the roof from the ${Math.floor(b.strong.y)} permit` : 'Still the first roof'}: ${pct(b.strong ? (st.pPerm || 0) : st.pOrig)} · 15 years or older: ${pct(st.pOld15)} · 20 or older: ${pct(st.pOld20)} · average age ${D(st.age, 0)} years.${topS && topS.si != null && topS.share >= 0.08 ? ` Put on after ${esc(stormName(SIDS[topS.si]))}: ${pct(topS.share)}.` : ''}`}${rf.factor < 1 ? ` Weighted by ${pct(rf.factor)}, the share of a building like this a roofer would expect to work on.` : ''}</div>
            <div class="sc-lines">${b.lines.map(id => `<button type="button" class="chip" data-line="${esc(id)}" title="Open ${esc(lineName(id))} in Service Lines for ZIP ${esc(b.zip || '')}">${esc(lineName(id))}</button>`).join('')}</div>${b.lines.includes('fortified') ? `<p class="sc-note">FORTIFIED: a Louisiana Fortify Homes Program grant of up to ${M$((META.fort && META.fort.grant) || 10000)} applies only if the home is owner occupied with a homestead exemption and carries wind coverage (flood insurance too in a flood zone); mobile homes, condominiums and recently built homes are not eligible (module 03) ${G('B')}</p>` : ''}</div>
          <div class="sc-sec"><p class="sc-k">Evidence</p><ul class="sc-ev"><li>${ybTxt}</li><li>${permTxt}</li><li>${evTxt}</li>${resetTxt ? `<li>${resetTxt}</li>` : ''}${ctx ? `<li>${ctx}</li>` : ''}<li><b>${esc((PROF[b.cls] || PROF.unk).l)}</b>: FEMA USA Structures (${esc(b.occ || 'unclassified')}${b.prim && b.prim !== b.occ ? ', ' + esc(b.prim) : ''})${b.acc ? '; read as an accessory building because a larger structure shares its address' : ''} ${G('C')}</li></ul></div>
          <div class="sc-sec sc-check"><p class="sc-k">Field check: what you saw on the roof or from the street</p>
            <div class="seg" id="scCkS" role="group" aria-label="Your status">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely'], ['', 'Model']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${(ck.s || '') === v}">${l}</button>`).join('')}</div>
            <div class="sc-cues">${CUES.map(([k, l]) => `<label class="chk"><input type="checkbox" data-cue="${k}"${(ck.cues || []).includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>
            <input type="text" id="scCkN" maxlength="240" placeholder="A note (kept in this browser)" value="${esc(ck.note || '')}">
            ${ck.at ? `<p class="sc-note">Checked ${esc(new Date(ck.at).toLocaleString())}</p>` : ''}</div>
          <div class="sc-acts"><button class="btn sm" id="scSv1">Street view</button><button class="btn sm sec" id="scSvG">Google photos</button><button class="btn sm sec" id="scCopy">Copy address</button><button class="btn sm sec" data-go-lines="1">Service Lines ↗</button><button class="btn sm sec" id="scDesk1">Campaign Desk ↗</button></div>`;
        $('#scSv1', dt).onclick = () => { open3D({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        $('#scSvG', dt).onclick = () => { showSV({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
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
        return `<p class="sc-k" style="margin-top:12px">Highest roof demand</p>${top.map(z => `<div class="rowl"><span><button type="button" class="lnk" data-zip="${esc(z.zip)}">${esc(z.zip)} · ${esc(z.city)}</button></span><b>${D(z.idx, 0)}</b></div>`).join('')}`;
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
        box.innerHTML = `<div class="sc-sv"><button type="button" class="btn sc-svgo" id="scSvShow">Street view (3D), every building glowing</button><button type="button" class="btn sec sc-svgo" id="scSvPh">Google photos of this street</button>
          <p class="sc-note">Live Google Street View in the map's place, ${where}: drag to look around, click the arrows in the picture to walk the street, and step from building to building. The satellite map comes back with one click. <a href="${esc(svURL(v))}" id="scSvGo" target="scout-streetview" referrerpolicy="no-referrer">Open it in Google Maps instead ↗</a></p>
          <div id="scMly"></div>
          <div class="sc-acts" style="margin-top:2px"><a class="btn sm sec" href="${esc(satURL(target.lat, target.lon))}" target="scout-streetview" referrerpolicy="no-referrer">Google satellite ↗</a><a class="btn sm sec" href="${esc(mlyURL(target.lat, target.lon))}" target="_blank" rel="noopener noreferrer">Mapillary ↗</a></div></div>`;
        $('#scSvShow', root).onclick = () => { open3D(target); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        $('#scSvPh', root).onclick = () => { showSV(target); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
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
      const pitchFor = b => !b ? 0 : b.roof && b.roof.slope === 'low' ? (b.h > 14 ? 22 : 14) : b.h > 8 ? 12 : 8;   /* tilt up for the roof */

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
      function ensureAround(la, lo, r) {
        r = r || 180; const dLa = r / 110900, dLo = r / (111320 * Math.cos(rad(la))), ks = new Set();
        for (let x = lon2x(lo - dLo, TILE_Z); x <= lon2x(lo + dLo, TILE_Z); x++) for (let y = lat2y(la + dLa, TILE_Z); y <= lat2y(la - dLa, TILE_Z); y++) ks.add(x + '/' + y);
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
        const was = viewMode; viewMode = m; svMode = m === 'sv'; d3Mode = m === '3d';
        if (!svMode) { svf.src = 'about:blank'; GM.live = false; GM.hov = null; }   /* unload the plain player before its frame is hidden: at 0 by 0 it logs errors of its own */
        if (!d3Mode && d3) d3.stop();
        $$('#scMode button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === m)));
        host.hidden = m !== 'map'; svw.hidden = !svMode; d3w.hidden = !d3Mode; hideTip();
        $('#scModeNote', root).textContent = svMode ? 'Google\'s photographs of the street. The satellite map and the 3D view are hidden while they show: Google\'s terms keep its Street View off any screen with another map.' : d3Mode ? 'The neighborhood built from open data, every building glowing in its colour. Walk the streets and alleys, or rise to drone and bird height for the roofs.' : 'Pick a building, then Street view to stand in the street in front of it (or double click the building).';
        if (m === 'map') { if (svFull) full(false); const t = was === '3d' ? d3Target : svTarget; setTimeout(() => { map.invalidateSize({ pan: true }); if (t) map.panTo([t.lat, t.lon]); }, 0); }
        if (d3Mode && d3) d3.start();
      }
      /* Full window: the map card covers the page, so everything outside it is made inert (focus cannot reach a covered
         control) while the toast and the tooltip stay live; and leaving the tab by any route (a rail tab, a typed hash, a
         hand off) ends it, so the next module is never left unscrollable */
      const inertOut = on => {
        if (!on) { document.querySelectorAll('[data-sc-inert]').forEach(e => { e.inert = false; e.removeAttribute('data-sc-inert'); }); return; }
        for (let n = mapCard; n && n.parentElement && n !== document.body; n = n.parentElement)
          [...n.parentElement.children].forEach(c => { if (c === n || c.inert || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(c.tagName) || c.classList.contains('toast') || c.id === 'tip' || c.hasAttribute('aria-live')) return; c.inert = true; c.setAttribute('data-sc-inert', ''); });
      };
      function full(on) { svFull = !!on; mapCard.classList.toggle('sc-full', svFull); document.documentElement.classList.toggle('sc-noscroll', svFull); inertOut(svFull); if (svMode) { renderSvBar(); drawSoon(); } if (d3Mode) render3DBar(); }
      new MutationObserver(() => { if (root.hidden && svFull) full(false); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
      /* the buildings to step through: those in view when Street View opened, likely ones first, highest scores first */
      function svListNow() {
        const bd = curBounds(), rank = { g: 3, o: 2, r: 1 };
        return [...B.values()].filter(b => bd.contains([b.lat, b.lon]) && shown(b) && b.roof.keys && b.roof.keys.length).sort((a, b) => rank[b.status] - rank[a.status] || b.sc.score - a.sc.score).map(b => b.id);
      }
      async function showSV(target) {
        if (!target) return; const my = ++svTok2; svTarget = target;
        if (!svMode) { if (viewMode === 'map') { viewBounds = map.getBounds(); svList = svListNow(); } setMode('sv'); }
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
        svBar.innerHTML = `<div class="sc-svinfo">${b ? `<span class="sc-pill ${b.status}">${STL[b.status]}</span><b>${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</b><span class="mini">${esc([(PROF[b.cls] || PROF.unk).l, b.roof.short, needLabel(b), 'score ' + b.sc.score].join(' · '))}</span>` : `<b>A point on the map</b><span class="mini">${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</span>`}</div>
          <div class="sc-svctl">
            ${b && svList.length > 1 ? `<button type="button" class="ibtn" data-a="prev" title="The previous building (likely ones first, highest scores first)" aria-label="Previous building">◀</button><span class="mini sc-svn">${N(i + 1)} of ${N(svList.length)}</span><button type="button" class="ibtn" data-a="next" title="The next building" aria-label="Next building">▶</button>` : ''}
            <button type="button" class="ibtn" data-a="left" title="Turn left 45°" aria-label="Turn left">↺</button>${b ? '<button type="button" class="ibtn" data-a="face" title="Turn back to face the building">Face it</button>' : ''}<button type="button" class="ibtn" data-a="right" title="Turn right 45°" aria-label="Turn right">↻</button>
            ${b ? `<span class="seg sc-svck" role="group" aria-label="Your field check">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely']].map(([k, l]) => `<button type="button" data-ck="${k}" aria-pressed="${!!(CK[b.id] && CK[b.id].s === k)}" title="Mark what you see: ${l.toLowerCase()}">${l}</button>`).join('')}</span>` : ''}
            <button type="button" class="ibtn" data-a="full">${svFull ? '⤡ Exit full window' : '⤢ Full window'}</button>
            <a class="ibtn" href="${esc(svURL(gl))}" target="scout-streetview" referrerpolicy="no-referrer" title="Open this view in Google Maps">Google Maps ↗</a>
            <button type="button" class="ibtn" data-a="3d" title="The 3D street view, every building glowing, no key">Street view (3D)</button>
            <button type="button" class="btn sm" data-a="map">Back to satellite</button>
          </div>
          <div class="sc-svwhere">${whereText()}</div>
          ${glowOn() ? '' : `<form class="sc-svkey" id="scSvKeyF" autocomplete="off"><span><b>Glows on Google's photos:</b> ${GM.failed ? esc(GM.failed) + ' ' : ''}this plain player is sealed and says nothing about where it looks, so glows on the photos need a Google Maps key (Maps JavaScript API). The <b>Street view (3D)</b> has every building glowing without one.</span><input type="password" id="scSvKey" placeholder="Paste a Google Maps key (AIza…)" spellcheck="false" aria-label="Google Maps key"><button class="btn sm" type="submit">Turn on glows</button><a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer">How to get a key ↗</a></form>`}`;
        $$('[data-a]', svBar).forEach(x => x.onclick = () => { const a = x.dataset.a; if (a === 'map') setMode('map'); else if (a === 'full') full(!svFull); else if (a === 'left') turn(-45); else if (a === 'right') turn(45); else if (a === 'face') face(); else if (a === 'prev' || a === 'next') step(a === 'next' ? 1 : -1); else if (a === '3d') open3D(svTarget); });
        $$('[data-ck]', svBar).forEach(x => x.onclick = () => { const k = x.dataset.ck, cur = CK[b.id] && CK[b.id].s; setCheck(b.id, { s: cur === k ? undefined : k }); statusOf(b); draw(b); refreshSoon(); renderSvBar(); drawSoon(); if (sel && sel.type === 'b' && sel.id === b.id) detail(); });
        const kf = $('#scSvKeyF', svBar); if (kf) kf.onsubmit = e => { e.preventDefault(); const k = $('#scSvKey', kf).value.trim(); if (!k) { toast('Paste a key first'); return; } CFG.gKey = k.slice(0, 200); GM.failed = ''; saveCfg(); settings(); toast('Google Maps key saved in this browser'); showSV(svTarget); };
      }
      $$('#scMode button', root).forEach(x => x.onclick = () => {
        const v = x.dataset.v; if (v === viewMode) return;
        if (v === 'map') { setMode('map'); return; }
        const sb = sel && sel.type === 'b' ? B.get(sel.id) : null; let t;
        if (sb) t = { lat: sb.lat, lon: sb.lon, street: sb.street, b: sb };
        else if (viewMode === '3d' && d3) { const s2 = d3.state(); t = { lat: s2.lat, lon: s2.lon, street: '', b: null }; }
        else if (viewMode === 'sv' && svTarget) t = svTarget;
        else if (sel && sel.type === 'pt') t = { lat: sel.lat, lon: sel.lon, street: '', b: null };
        else { const c = map.getCenter(); if (map.getZoom() < 14) toast('Showing the street nearest the map\'s centre. Pick a building to aim at it.'); t = { lat: c.lat, lon: c.lng, street: '', b: null }; }
        if (v === '3d') open3D(t); else showSV(t);
      });
      document.addEventListener('keydown', e => { if (e.key !== 'Escape' || viewMode === 'map' || root.hidden) return; if (svFull) full(false); else setMode('map'); });

      /* ---------- the 3D street view: the neighborhood built from open data, no key, the glows exact ---------- */
      /* scout3d.js builds it (FEMA buildings raised to their heights, Esri imagery on the roofs and the ground, OpenStreetMap
         streets and alleys); this part feeds it the module's buildings and readings and hears what the person does in it. It
         draws Esri imagery, so it is a non-Google map: it takes the card's place as the satellite map does, and never shares
         the screen with Google's photos. */
      const d3w = $('#sc3dW', root), d3Bar = $('#sc3dBar', root), d3Host = $('#sc3D', root);
      var d3 = null, d3Mode = false, d3Target = null, d3St = null, viewMode = 'map';
      /* the streets, alleys and drives around a point: OpenStreetMap through the Overpass API (the first public server that
         answers), or the Census TIGER file, which has the streets but not the alleys */
      const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
      const osmKind = t => { const h = t.highway || '', s = t.service || ''; if (/^(motorway|trunk|primary|secondary)(_link)?$/.test(h)) return 'major'; if (/^(tertiary|tertiary_link|residential|unclassified|living_street|road)$/.test(h)) return 'street'; if (h === 'service') return s === 'alley' ? 'alley' : /^(driveway|parking_aisle|drive-through|emergency_access)$/.test(s) ? 'drive' : 'service'; if (/^(footway|path|pedestrian|cycleway|steps|track|bridleway)$/.test(h)) return 'path'; return null; };
      const tigerKind = m => /^S1(100|200|630)$/.test(m) ? 'major' : m === 'S1730' ? 'alley' : m === 'S1780' ? 'drive' : /^S1(640|740)$/.test(m) ? 'service' : /^S1(710|720|820|830)$/.test(m) ? 'path' : 'street';
      async function roads3d(la, lo, r) {
        const dLa = r / 110900, dLo = r / (111320 * Math.cos(rad(la))), bb = [la - dLa, lo - dLo, la + dLa, lo + dLo].map(v => v.toFixed(6)).join(',');
        const q = `[out:json][timeout:25];way["highway"](${bb});out tags geom;`;
        let answered = false;
        for (const url of OVERPASS) {
          const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
          try {
            const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal, credentials: 'omit' });
            if (!res.ok) continue; const j = await res.json();
            const list = (j.elements || []).filter(e => e.type === 'way' && e.geometry && e.geometry.length > 1).map(e => ({ name: (e.tags && (e.tags.name || e.tags.ref)) || '', kind: osmKind(e.tags || {}), pts: e.geometry.map(g => [g.lat, g.lon]) })).filter(x => x.kind);
            if (list.length) { list.source = ''; return list; }
            answered = true; break;   /* a server that answers with no streets is believed: the area goes to no other server */
          } catch (e) { /* the next server */ } finally { clearTimeout(tm); }
        }
        const ks = new Set(); [[0, 0], [dLa, 0], [-dLa, 0], [0, dLo], [0, -dLo], [dLa, dLo], [-dLa, -dLo], [dLa, -dLo], [-dLa, dLo]].forEach(([a, b]) => ks.add(tileOf(la + a, lo + b)));
        const parts = await Promise.all([...ks].map(t => roadsFor(t).catch(() => Object.assign([], { failed: true })))), failed = parts.some(x => x.failed), all = parts.flat(), seen = new Set();
        const list = all.filter(r => { const k = r.line.map(p => p.join()).join(';'); if (seen.has(k)) return false; seen.add(k); return true; }).map(r => ({ name: r.name, kind: tigerKind(r.m || ''), pts: r.line }));
        const osm = answered ? 'OpenStreetMap has no streets here' : 'OpenStreetMap did not answer';
        list.source = list.length ? `${osm}, so the streets are the Census TIGER file's and the alleys are missing.` : `No streets loaded: ${osm}, and the Census TIGER file ${failed ? (answered ? 'did not answer' : 'did not answer either') : 'has none here'}. The view still walks freely.`;
        return list;
      }
      const flatRoof = b => !!(b.roof && b.roof.slope === 'low');
      const env3d = {
        tileURL: (z, x, y) => (CFG.arcgisKey ? EP.esriKey : EP.esri) + 'World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x + (CFG.arcgisKey ? '?token=' + encodeURIComponent(CFG.arcgisKey) : ''),
        buildings: () => { const cur = d3Target && d3Target.b ? d3Target.b.id : null, out = []; B.forEach(b => { if (b.sc && (shown(b) || b.id === cur)) out.push(b); }); return out; },
        byId: id => B.get(id) || null, height: b => hOf(b), flat: flatRoof,
        /* the share of houses drawn in brick (judgment): New Orleans is mostly weatherboard (shotguns, Creole cottages, camelbacks).
           Duplexes to fourplexes (FEMA's multifamily class, read as houses) are drawn as houses; larger blocks keep the apartment look */
        brickShare: b => (b.cls === 'mf' && !(b.roof && b.roof.units <= 4) ? null : (b.fips === '22071' ? 0.15 : 0.45)), color: b => COL[b.status], labelInk: b => (b.status === 'r' ? '#ffffff' : '#10191f'), label: b => `${STS[b.status]} · ${b.sc.score}`,
        roads: roads3d, ensure: (la, lo, r) => ensureAround(la, lo, r),
        onHover: (b, e) => { if (b && e) showTip(bTip(b).replace('Click for the full reading · double click for Street View', 'Click to read it · double click to stand in front of it'), e); else hideTip(); },
        onPick: b => { hideTip(); pick(b.id, { noSV: true }); },
        onFront: b => { hideTip(); pick(b.id); },
        onMove: st => { d3St = st; whereSoon(); },
        onNote: t => { const n = $('#sc3dNote', root); if (n) n.textContent = t || ''; },
        onGraphics: () => render3DBar(),
        googleKey: () => CFG.gKey || '',
        facts: b => ({ address: b.addr ? title(b.addr) : '', zip: b.zip || b.zipF || '', city: b.city ? title(b.city) : '', use: (PROF[b.cls] || PROF.unk).l, reading: STL[b.status], score: b.sc.score, likelyRoof: b.roof.short, likelyNeed: needLabel(b), roofAgeYears: b.roof.keys && b.roof.keys.length ? Math.round(b.state.age) : null, heightMeters: Math.round(hOf(b) * 10) / 10, fieldCheck: CK[b.id] && CK[b.id].s ? STL[CK[b.id].s] : '' }),
      };
      const refresh3D = debounce(() => { if (d3 && d3Mode) d3.refresh(); }, 350);
      async function open3D(target) {
        if (!target) return;
        if (!d3 && !window.__SCOUT_3D__ && document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        if (!d3) { d3 = window.__SCOUT_THREE__ && window.__SCOUT_3D__ ? window.__SCOUT_3D__(window.__SCOUT_THREE__, d3Host, env3d) : null; if (!d3) { toast('This browser cannot draw the 3D view (WebGL is off or missing). Google photos still work.'); return; } }
        d3Target = target; if (viewMode === 'map') { viewBounds = map.getBounds(); svList = svListNow(); }
        if (!d3Mode) setMode('3d');
        render3DBar();
        let v; try { v = await aim(target); } catch (e) { v = { lat: target.lat, lon: target.lon, heading: 0 }; }
        if (!d3Mode || d3Target !== target) return;
        await d3.open(v.lat, v.lon, target.b ? null : v.heading, { cur: target.b ? target.b.id : null, face: target.b || null });
        render3DBar(); try { d3.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ }
      }
      function where3D(st) {
        if (!st) return '';
        const b = d3Target && d3Target.b ? (B.get(d3Target.b.id) || d3Target.b) : null, facing = b && Math.abs(((st.yaw - bearing([st.lat, st.lon], [b.lat, b.lon]) + 540) % 360) - 180) < 25;
        const kind = { major: 'main road', alley: 'alley', service: 'service drive' }[st.roadKind] || '';
        const on = st.mode === 'street' ? (st.road ? `On ${esc(st.road)}${kind ? ' (' + kind + ')' : ''}` : kind === 'alley' ? 'In an alley' : kind ? 'On a ' + kind : 'At street level') : st.mode === 'drone' ? 'At drone height, 38 m up' : 'At bird height, 120 m up';
        return `${on}, looking ${compass(st.yaw)}${facing ? ' at the building' : ''} · <b>${N(st.built)}</b> buildings glowing${st.roads ? '' : st.roadsDone ? ' · no streets loaded' : ' · the streets are still loading'}. Drag to look around; <b>W</b> and <b>S</b> (or ▲ ▼) walk the street, <b>A</b> and <b>D</b> turn, <b>Q</b> and <b>E</b> rise and come down; click the ground to go there, a building to read it, double click to stand in front of it.`;
      }
      const whereSoon = debounce(() => { const w = $('#sc3dWhere', root); if (w && d3Mode) w.innerHTML = where3D(d3St || (d3 && d3.state())); if (d3 && d3St) $$('#sc3dBar [data-h]', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.h === d3St.mode))); }, 90);
      let gfxOpen = false;
      /* the model under the glows: the measured one (no key), or Google's photoreal 3D mesh (a Google key with the Map Tiles API) */
      function modelSeg() {
        const g = d3 && d3.graphics ? d3.graphics() : null; if (!g || !g.photoAvail) return '';
        const on = g.photo, warn = on && g.photoErr ? ' sc-warn' : '';
        return `<span class="seg${warn}" role="group" aria-label="Model"><button type="button" data-model="measured" aria-pressed="${!on}" title="Drawn by the page from the newest satellite photo of 2024 or later, traced by AI on this computer: no key">Traced (newest photo)</button><button type="button" data-model="photo" aria-pressed="${on}" title="Google's Photorealistic 3D Tiles: the real streets, houses and trees as photographed (Google key with the Map Tiles API)">Photoreal (Google)</button></span>`;
      }
      function photoForm() {
        const g = d3 && d3.graphics ? d3.graphics() : null; if (!g || !g.photo || (g.photoReady && !g.photoErr)) return '';
        if (g.hasKey && !g.photoErr) return `<div class="sc-svwhere mini">Loading Google's photoreal 3D tiles…</div>`;
        return `<form class="sc-svkey" id="sc3dKeyF" autocomplete="off"><span><b>Photoreal 3D:</b> ${g.photoErr ? esc(g.photoErr) + ' Paste another key, or the same one once it is fixed. The key stays in this browser.' : 'Google\'s Photorealistic 3D Tiles are the real neighborhood as photographed from the air (the data behind Google Earth\'s 3D). They need a Google Maps key with the <b>Map Tiles API</b> turned on (Google Cloud console, APIs and Services; billing on, and Google\'s free monthly use covers testing). The key stays in this browser.'}</span><input type="password" id="sc3dKey" placeholder="Paste a Google Maps key (AIza…)" spellcheck="false" aria-label="Google Maps key"><button class="btn sm" type="submit">Turn on photoreal</button><a href="https://developers.google.com/maps/documentation/tile/3d-tiles" target="_blank" rel="noopener noreferrer">About the 3D tiles ↗</a></form>`;
      }
      const slugA = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'area';
      function gfxMenu() {
        const g = d3 && d3.graphics ? d3.graphics() : null; if (!g) return '';
        const seg = (name, cur, opts) => `<span class="seg" role="group" aria-label="${name}">${opts.map(([k, l]) => `<button type="button" data-g="${name}:${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</span>`;
        return `<details class="sc-gfx" id="sc3dGfx"${gfxOpen ? ' open' : ''}><summary class="ibtn" title="Quality, the hour of the sun, trees">Graphics: ${esc(g.label)}${g.q === 'auto' ? ' (auto)' : ''}</summary><div class="sc-gfxp">
            <div class="sc-gfxr"><span class="mini">Quality</span>${seg('q', g.q, [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['basic', 'Basic']])}</div>
            <div class="sc-gfxr"><span class="mini">Sun</span>${seg('sun', g.sun, [['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['now', 'Now']])}</div>
            <div class="sc-gfxr"><span class="mini">Trees</span>${seg('trees', g.trees ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
            <div class="sc-gfxr"><span class="mini">AI tracing</span>${seg('ai', g.ai ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}<span class="mini">${g.ai ? (g.traceDate ? esc(g.traceSource || '') + ', ' + esc(g.traceDate) + (g.traceBackend ? ' · ' + esc(g.traceBackend.startsWith('webgpu') ? 'graphics card' : 'processor') : '') : 'the newest photo of 2024 or later') : 'off: buildings as recorded'}</span></div>
            <p class="mini">High: sun shadows, ambient occlusion, bloom on the glows, 4× antialiasing. Medium: lighter shadows, no ambient occlusion. Basic: no shadows or effects, for older machines. Auto picks one for this machine (${esc(g.auto)} here) and steps down if the walk stutters. The sun stands where it does over this street today at that hour.${g.sunNote ? ' ' + esc(g.sunNote) : ''} AI tracing reads the newest satellite photo of 2024 or later on this computer (a download of 14 to 40 MB, once; seconds on a graphics card, a few minutes on a processor) to check the buildings and outline the trees; off, the buildings stand as recorded and the trees as the photo's colours place them.</p>
          </div></details>`;
      }
      function render3DBar() {
        const t = d3Target; if (!t) { d3Bar.innerHTML = ''; return; } const b = t.b ? (B.get(t.b.id) || t.b) : null, st = d3 ? d3.state() : null, mode = st ? st.mode : 'street';
        const gx = d3 && d3.graphics ? d3.graphics() : null, mn = $('#scModeNote', root);
        if (mn && d3Mode) mn.textContent = gx && gx.photo && gx.photoReady && !gx.photoErr ? 'Google\'s photoreal 3D tiles: the neighborhood as Google photographed it from the air, every building glowing in its colour. Walk the streets and alleys, or rise to drone and bird height for the roofs.' : 'The neighborhood built from open data, every building glowing in its colour. Walk the streets and alleys, or rise to drone and bird height for the roofs.';
        if (b && !svList.includes(b.id)) { svList = svListNow(); if (!svList.includes(b.id)) svList.unshift(b.id); }
        const i = b ? svList.indexOf(b.id) : -1;
        d3Bar.innerHTML = `<div class="sc-svinfo">${b ? `<span class="sc-pill ${b.status}">${STL[b.status]}</span><b>${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</b><span class="mini">${esc([(PROF[b.cls] || PROF.unk).l, b.roof.short, needLabel(b), 'score ' + b.sc.score].join(' · '))}</span>` : `<b>A point on the map</b><span class="mini">${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</span>`}</div>
          <div class="sc-svctl">
            ${b && svList.length > 1 ? `<button type="button" class="ibtn" data-a="prev" title="The previous building (likely ones first, highest scores first)" aria-label="Previous building">◀</button><span class="mini sc-svn">${N(i + 1)} of ${N(svList.length)}</span><button type="button" class="ibtn" data-a="next" title="The next building" aria-label="Next building">▶</button>` : ''}
            <span class="seg" role="group" aria-label="Height">${[['street', 'Street'], ['drone', 'Drone'], ['bird', 'Bird']].map(([k, l]) => `<button type="button" data-h="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</span>
            ${b ? '<button type="button" class="ibtn" data-a="face" title="Turn to face the building">Face it</button>' : ''}
            ${b ? `<span class="seg sc-svck" role="group" aria-label="Your field check">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely']].map(([k, l]) => `<button type="button" data-ck="${k}" aria-pressed="${!!(CK[b.id] && CK[b.id].s === k)}" title="Mark what you see: ${l.toLowerCase()}">${l}</button>`).join('')}</span>` : ''}
            ${modelSeg()}
            ${gfxMenu()}
            <button type="button" class="ibtn" data-a="export" title="Download this area as a 3D model (glTF .glb) for Unreal Engine 5, Blender or any 3D tool: every building with its reading and its glow, the streets and the trees (Esri's imagery stays out)">⇩ 3D model for Unreal</button>
            <button type="button" class="ibtn" data-a="full">${svFull ? '⤡ Exit full window' : '⤢ Full window'}</button>
            <button type="button" class="ibtn" data-a="photos" title="Google's photographs of this street, in the card's place">Google photos</button>
            <button type="button" class="btn sm" data-a="map">Back to satellite</button>
          </div>
          <div class="sc-svwhere" id="sc3dWhere">${where3D(st)}</div>${photoForm()}`;
        $$('[data-a]', d3Bar).forEach(x => x.onclick = () => { const a = x.dataset.a;
          if (a === 'map') setMode('map'); else if (a === 'full') full(!svFull); else if (a === 'face' && d3 && b) d3.face(b); else if (a === 'prev' || a === 'next') step(a === 'next' ? 1 : -1);
          else if (a === 'export' && d3 && d3.exportGLB) { x.disabled = true; x.textContent = 'Building the model…'; const s2 = d3.state(); d3.exportGLB().then(blob => saveFile(`rooftop-scout-3d-${slugA(s2.road)}-${new Date().toISOString().slice(0, 10)}.glb`, blob)).catch(e => toast('The 3D model did not build: ' + (e && e.message || e))).finally(() => render3DBar()); }
          else if (a === 'photos') { const s2 = d3 ? d3.state() : null; showSV(b ? { lat: b.lat, lon: b.lon, street: b.street, b } : s2 ? { lat: s2.lat, lon: s2.lon, street: '', b: null } : t); } });
        $$('[data-h]', d3Bar).forEach(x => x.onclick = () => { if (d3) { d3.setHeight(x.dataset.h); whereSoon(); } });
        const gd = $('#sc3dGfx', d3Bar); if (gd) gd.addEventListener('toggle', () => { gfxOpen = gd.open; });
        $$('[data-model]', d3Bar).forEach(x => x.onclick = () => { if (!d3) return; d3.setGraphics({ photo: x.dataset.model === 'photo' }); render3DBar(); });
        const kf3 = $('#sc3dKeyF', d3Bar); if (kf3) kf3.onsubmit = e => { e.preventDefault(); const k = $('#sc3dKey', kf3).value.trim(); if (!k) { toast('Paste a key first'); return; } CFG.gKey = k.slice(0, 200); GM.failed = ''; saveCfg(); settings(); toast('Google Maps key saved in this browser'); if (d3) d3.setGraphics({ photo: true }); render3DBar(); };
        $$('[data-g]', d3Bar).forEach(x => x.onclick = () => { const [k, v] = x.dataset.g.split(':'); if (!d3) return; d3.setGraphics(k === 'trees' || k === 'ai' ? { [k]: v === 'on' } : { [k]: v }); render3DBar(); });
        $$('[data-ck]', d3Bar).forEach(x => x.onclick = () => { const k = x.dataset.ck, cur = CK[b.id] && CK[b.id].s; setCheck(b.id, { s: cur === k ? undefined : k }); statusOf(b); draw(b); refreshSoon(); render3DBar(); if (d3) d3.refresh(); if (sel && sel.type === 'b' && sel.id === b.id) detail(); });
      }
      /* the walk pad over the view: hold to walk or turn; Enter or Space for a step */
      $$('#sc3dPad button', root).forEach(x => {
        const k = x.dataset.k, on = e => { e.preventDefault(); if (d3) d3.hold(k, true); }, off = () => { if (d3) d3.hold(k, false); };
        x.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => x.addEventListener(ev, off));
        x.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); if (!d3) return; if (k === 'fwd') d3.walk(8); else if (k === 'back') d3.walk(-8); else d3.turn(k === 'left' ? -20 : 20); });
      });

      /* ---------- imagery: which pictures are under the centre of the map ---------- */
      let imgNote = '';
      const imgInfo = debounce(async () => {
        if (VIEWER || CFG.imagery === 'street' || map.getZoom() < 13) return;
        const c = map.getCenter(), bd = map.getBounds(), sz = map.getSize();
        try {
          const j = await getJSON(EP.esri + 'World_Imagery/MapServer/identify?' + qs({ geometry: c.lng.toFixed(6) + ',' + c.lat.toFixed(6), geometryType: 'esriGeometryPoint', sr: 4326, layers: 'all', tolerance: 1, mapExtent: [bd.getWest(), bd.getSouth(), bd.getEast(), bd.getNorth()].map(v => v.toFixed(6)).join(','), imageDisplay: sz.x + ',' + sz.y + ',96', returnGeometry: 'false', f: 'json' }), { timeout: 15000 });
          const r = j.results || [], m = r.find(x => x.layerId === 0), c15 = r.find(x => x.layerId === 8 && x.attributes && x.attributes.SRC_DATE2 && x.attributes.SRC_DATE2 !== 'Null');
          const fa = c15 ? c15.attributes : ((r.find(x => x.layerId === 9) || {}).attributes || {}); fineRes = +fa.SRC_RES > 0 ? +fa.SRC_RES : null;
          const had = cm15; cm15 = !!c15; if ((had === true) !== cm15) setBase();
          const a = (m && m.attributes) || {}, d = a.SRC_DATE2 && a.SRC_DATE2 !== 'Null' ? new Date(a.SRC_DATE2) : null;
          imgNote = m ? `Imagery under the centre: ${esc(a.SOURCE || 'Esri')} ${esc(a.SOURCE_INFO || '')}${a['RESOLUTION (M)'] ? ', ' + esc(a['RESOLUTION (M)']) + ' m' : ''}${d && !isNaN(d) ? ', captured ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}${c15 ? `; at the closest zoom ${esc(c15.attributes.NICE_DESC || '')} ${esc(c15.attributes.NICE_NAME || '')}${+c15.attributes.SRC_RES > 0 ? ', ' + esc(c15.attributes.SRC_RES) + ' m' : ''}, ${esc(new Date(c15.attributes.SRC_DATE2).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}` : ''}.` : '';
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
        if (/^\d{5}$/.test(q)) { if (ZPI[q]) zoomZip(q); else toast('ZIP ' + q + ' is not in the atlas\'s Louisiana ZIPs'); return; }
        const ql = q.toLowerCase().replace(/\s+parish$/, '').replace(/^st\.?\s+/, 'st. ');
        const cz = Z.filter(z => String(z.city).toLowerCase() === q.toLowerCase() && ZPI[z.zip]);
        if (cz.length) { selZip = null; map.fitBounds(LF.latLngBounds(cz.flatMap(z => ZPI[z.zip].rings.flat())), { padding: [20, 20], maxZoom: 14 }); paintHeat(); return; }
        const pa = PA.find(p => String(p.name).toLowerCase() === ql || String(p.name).toLowerCase() === q.toLowerCase().replace(/\s+parish$/, ''));
        if (pa && CTYI[pa.fips]) { selZip = null; map.fitBounds(LF.latLngBounds(CTYI[pa.fips].rings.flat()), { padding: [20, 20], maxZoom: 13 }); paintHeat(); toast(pa.name + ' Parish'); return; }
        if (VIEWER) { toast('Address search needs the network'); return; }
        try {
          const j = await getJSON(EP.geocode + '?' + qs({ f: 'json', singleLine: q, maxLocations: 1, outFields: 'Match_addr,Addr_type', searchExtent: '-94.1,28.9,-88.8,33.1', location: '-91.6,30.9', countryCode: 'USA' }), { timeout: 15000 });
          const c = (j.candidates || [])[0];
          if (!c || c.score < 75 || !c.location || c.location.y < 28.8 || c.location.y > 33.1 || c.location.x < -94.1 || c.location.x > -88.7) { toast('No match in Louisiana for that address'); return; }
          pendingPick = { lat: c.location.y, lon: c.location.x }; map.setView([c.location.y, c.location.x], Math.max(19, CFG.minZoom)); toast(c.address); setTimeout(tryPending, 50);
        } catch (err) { toast('Address search failed: ' + why(err)); }
      };
      $('#scCsv', root).onclick = () => exportCSV();
      $('#scLinesGo', root).onclick = () => goModule('lines', selZip ? { zip: selZip } : {});
      $('#scDeskGo', root).onclick = () => { const zs = [...new Set(inViewB().filter(b => b.status === 'g').map(b => b.zip).filter(Boolean))]; const zz = zs.length ? zs : (selZip ? [selZip] : []); if (!zz.length) { toast('Zoom to street level or pick a ZIP first'); return; } goModule('desk', { zips: zz }); };

      /* ---------- the CSV a crew or a mailer can work from ---------- */
      /* a cell a spreadsheet would read as a formula (=, @, + or - before text) is kept as text */
      const cell = v => typeof v === 'string' && /^[=@\t\r]|^[+-](?!\$?[\d.,]*%?$)/.test(v) ? "'" + v : v;
      function exportCSV() {
        const bs = inViewB().filter(shown).sort((a, b) => b.sc.score - a.sc.score);
        if (!bs.length) { toast(map.getZoom() < CFG.minZoom ? 'Zoom to street level first' : 'No buildings in view'); return; }
        const header = ['status', 'score', 'likely_need', 'address', 'city', 'zip', 'parish', 'use', 'fema_occupancy', 'footprint_sqft', 'height_m', 'roof_squares', 'year_built', 'year_built_source', 'last_roof_permit', 'last_roof_permit_work', 'roof_permits_on_file', 'likely_roof', 'roof_odds', 'slope', 'roof_age_mean', 'p_replace_5yr', 'p_repair_12mo', 'p_wind_damage_open', 'p_hail_damage_open', 'p_first_roof', 'p_roof_from_reroof_permit', 'p_roof_20_plus', 'storm_rebuild', 'service_lines', 'field_check', 'field_cues', 'field_note', 'lat', 'lon', 'street_view'];
        const rows = bs.map(b => { const ck = CK[b.id] || {}, rf = b.roof, has = !!(rf.keys && rf.keys.length), top = b.state.storms && b.state.storms[0]; return [STL[b.status], b.sc.score, needLabel(b), b.addr ? title(b.addr) : '', b.city ? title(b.city) : (b.z ? b.z.city : ''), b.zip || '', b.fips ? CNAME(b.fips) : '', (PROF[b.cls] || PROF.unk).l, [b.occ, b.prim].filter(Boolean).join(' / '), Math.round(b.sqft || 0), b.h ? +(+b.h).toFixed(1) : '', rf.squares || '',
          b.yb || '', b.ybSrc === 'parcel' ? `${b.parcel && b.parcel.parish ? b.parcel.parish : PNAME(b.fips) || 'the'} Parish tax roll (parcel layer)` : b.ybSrc === 'permit' ? 'new construction permit' : 'estimated from the ZIP', b.last ? b.last.d : '', b.last ? String(b.last.desc).slice(0, 120) : '', b.permits.filter(p => p.kind !== 'newc' && p.w >= 0.15).length,
          rf.name, rf.mix ? rf.mix.map(([l, p]) => `${l} ${Math.round(p * 100)}%`).join('; ') : '', has ? rf.slope : '', has ? +b.state.age.toFixed(1) : '', +b.sc.P5.toFixed(3), +b.sc.REP.toFixed(3), +b.sc.WIND.toFixed(3), +b.sc.HAIL.toFixed(3), has ? +b.state.pOrig.toFixed(3) : '', has && b.strong ? +(b.state.pPerm || 0).toFixed(3) : '', has ? +b.state.pOld20.toFixed(3) : '', top && top.si != null && top.share >= 0.08 ? `${stormName(SIDS[top.si])} ${Math.round(top.share * 100)}%` : '', b.lines.map(lineName).join('; '),
          ck.s ? STL[ck.s] : '', (ck.cues || []).map(k => (CUES.find(c => c[0] === k) || [k, k])[1]).join('; '), ck.note || '', +b.lat.toFixed(6), +b.lon.toFixed(6), svURL({ lat: b.lat, lon: b.lon })].map(cell); });
        const zips = [...new Set(bs.map(b => b.zip).filter(Boolean))], d = new Date().toISOString().slice(0, 10);
        saveFile(`louisiana-rooftop-scout-${zips.length === 1 ? zips[0] : 'view'}-${d}.csv`, '\uFEFF' + toCSV(header, rows, `Rooftop Scout, Uplift Louisiana Roofing Atlas, ${d}. Model estimates from public records, not inspections: a status is a probability.\nScore: chance of at least one paid roofing job (a replacement within five years, a repair call within twelve months, or wind or hail damage still open). Green at ${CFG.green} or more, orange at ${CFG.orange}.\nSources: FEMA USA Structures; Lafayette and Vermilion Parish tax rolls (public parcel layer); City of New Orleans and East Baton Rouge Parish permits; NOAA Storm Events; NHC best tracks modeled to ZIP codes; the atlas roof age model (module 17). Street View links open Google Maps.`));
      }

      /* ---------- the method, settings, caveats, gaps and sources ---------- */
      const method = () => [
        `<b>The building ${G('C')}</b>. FEMA's USA Structures inventory (Oak Ridge National Laboratory): footprint, height, address where it has one, and an occupancy class for every structure over about 40 square meters. Its class sets the roof profile: a house, an apartment block, a strip center, a warehouse, a school.`,
        `<b>The roof it most likely carries ${G('D')}</b>. Homes: asphalt shingles, or metal at the ZIP's metal share (module 17's assumption, ${P(100 * ((META.model && META.model.ANCH && +META.model.ANCH.metal) || 0.12), 0)} statewide, more in rural and higher income ZIPs); a few percent tile or slate. Manufactured homes: their own roof (metal or shingles, roof overs and coatings). Garden apartments: pitched shingle roofs; mid rises and most commercial buildings: a low slope membrane (TPO, modified bitumen, built up); warehouses, plants and farm buildings: a metal building roof. The size in squares is the footprint with an allowance for pitch and eaves (1.22 times on a steep roof, 1.04 on a low slope one).`,
        `<b>The year built ${G('A')} or ${G('C')}</b>. The parish tax roll's year built, from the public parcel layer for Lafayette and Vermilion, joined by location: Lafayette's roll carries one on most parcels (none built after 2018), Vermilion's on a few, mostly homes built since 2017; no other parish's open parcel or footprint file carries a year built on more than about 1% of buildings. Elsewhere a New Orleans or East Baton Rouge new construction permit filed for the building itself dates it, or the ZIP's ACS year built mix stands in, leaned by the footprint for a house.`,
        `<b>The roof's age ${G('B')}</b>. Module 17's roof life (a Weibull life with a ${D(LIFE.shingle.L, 0)} year mean and shape ${D(LIFE.shingle.k, 0)} for shingles, calibrated to the 2023 American Housing Survey), run year by year from the year built: roofs wear out and are replaced, and each storm year replaces the share of roofs module 17's cohort model replaced at the ZIP that year (from 2000, FEMA verified roof and wind damage at ${D(+(META.model && META.model.DMG && META.model.DMG.M) || 2, 0)} roofs per registration before 2020 and ${D(+(META.model && META.model.ANCH && META.model.ANCH.M2020) || 3.6, 1)} since, grade D, where FEMA has it and the storm's modeled wind elsewhere; from 1992 to 1999, the modeled wind at module 02's damage curve, ${pct(dmgShare(64))} of roofs at hurricane force). Averaged over each ZIP's homes, the building model gives back module 17's ZIP roof ages for shingle roofs (a correlation of 0.998 across the scored ZIPs for the mean age, 0.992 for the share 20 or older); homes also carry the ZIP's metal share on a 40 year life, so they read about a year older than module 17's ZIP figures (0.986 and 0.975). Membranes and metal buildings use the atlas's ${D(LIFE.low.L, 0)} year commercial life and take wind at 70 percent of the residential rate (module 12's commercial line), apartment membranes at 80 percent (its multifamily line); metal homes use module 17's ${D(LIFE.metal.L, 0)} years and shed wind better than shingles (judgment); manufactured home roofs use ${D(LIFE.mh.L, 0)} years and take wind at 1.3 times the rate (module 12's mobile home line). Out come the chance the roof is still the first one, 20 or older, which storm rebuild it most likely dates from, and the chance it wears out within five years.`,
        `<b>Its last replacement ${G('A')}</b>. Roof permits at the building's address or map point: the City of New Orleans (reroof permits from May 2025, roof work inside renovation permits from 2012) and East Baton Rouge Parish (reroof permits from July 2025, roof work inside remodel permits from 2012, with map points mostly from 2016). A permit joins the main building at its address (when several share the address, the one its point falls in, else each of them in the same map square as its point, at a share of the permit's weight unless its text names them all), else the building its point falls in or the main building nearest it. A reroof permit restarts the roof's clock at its date; a repair or a partial reroof (roof work on an addition, a dormer or a lean to alone counts as one) moves it a little; a renovation that only mentions the roof, roof work on a porch, garage, shed or other accessory structure, and rooftop equipment such as solar panels do not move it. Since August 1, 2025 every reroof needs a permit (Act 239 of 2025), so these files will hold most reroofs from here on.`,
        `<b>Repairs ${G('C')}</b>. Leak and repair calls a year rise with roof age (${D(0.35 * REP_BASE / REP_TARGET, 1)} times the average under 5 years, ${D(2 * REP_BASE / REP_TARGET, 1)} times it past 25; judgment), scaled so the state's roofs at module 17's ages make the atlas's repair line: ${pct(REP_TARGET)} of one unit roofs a year.`,
        `<b>Wind and hail still open ${G('B')}</b>. NOAA Storm Events reports of the last three years within 5 km: hail of an inch or more (a 4% to 28% chance of roof damage by size, fading to nothing at 5 km), thunderstorm wind of 58 mph or more (within 3 km) and EF1 or stronger tornadoes (within 1.5 km), with commercial roofs taking hail at 30 percent of the residential rate; and hurricanes and tropical storms that reached the ZIP in the last three years, at the larger of one and a half times module 17's replacement share that year (replacements and repairs) and half of module 02's wind curve, of which half is still open in the first year after the storm, a quarter in the second and a tenth in the third. Report damage fades as claims settle (all of it within a year, about half in the second, a third in the third); reports of one storm (the same weekday of the same month, within three hours: the reports carry no day of the month) count once, at the strongest; nothing from before a building's year on file counts; and a reroof permit after the event closes most of it.`,
        `<b>The score and the colour</b>. The chance of at least one paid roofing job: a replacement within five years, a repair call within twelve months, or wind or hail damage still open, weighted by how much of a building like it a roofer would expect to work on (a parking deck almost none, a shed a third). Green at ${CFG.green} or more, orange at ${CFG.orange} to ${CFG.green - 1}, red below; both cut points are in Settings. The average Louisiana roof at module 17's ages scores about ${N(AVG_SCORE)}, so by default orange starts near the typical roof, green needs evidence of an older roof or recent storm damage, and red needs evidence of a newer one (a storm rebuild, a permit or a young building). A field check replaces the colour.`,
        `<b>The 3D street view ${G('C')}</b>. The neighborhood rebuilt in the browser, with no key, from the newest satellite photo of the place taken in 2024 or later (Esri's World Imagery metadata names it: Vantor's January 16, 2026 picture over Baton Rouge at 50 cm, for one). Over Baton Rouge, New Orleans and Shreveport no public 3D survey is that new (USGS lidar of 2018 over most of Baton Rouge, 2021 over New Orleans and 2018 over Shreveport; most of FEMA's footprints there come from NGA lidar of 2008 to 2012); USGS flew the coast from Cameron Parish to Terrebonne Parish in early 2024 (Houma and Franklin, not New Orleans or Lake Charles), and elsewhere FEMA's footprints are traced from ORNL imagery of 2015 to 2024. No lidar shapes the buildings or trees (only the photoreal view takes its ground from USGS's bare earth surface), so an AI model, SlimSAM (Segment Anything, pruned), runs on this computer and reads the photo: pointed at each building on record, it finds the roof the photo shows there. Where that roof fits the old outline (or is the part of it the trees leave in view, or fits it a few metres over), the building is <i>confirmed</i>; where a larger, square edged roof covers it, it is <i>redrawn</i> from the photo (its height kept, or raised to two storeys when it grew by half); where no roof shows, it is <i>under trees</i> and keeps its recorded outline. Every tree crown is outlined on a grid of points, its height estimated from its spread. The satellite looked a little sideways, so roofs show slightly off their walls: that lean is measured on the confirmed roofs and taken out. Houses have walls set back under their eaves, windows with frames, sills and glass, a front door facing the street and a garage door facing the alley or drive; roofs are modeled (hipped, or flat behind a parapet) and carry the same photo, shifted for its lean so each roof wears its own; the ground carries it too; the streets are asphalt and the alleys and drives concrete, from OpenStreetMap (the Census TIGER file when OpenStreetMap does not answer or has no streets there, without the alleys); each tree is a dome of photographed leaves over its traced outline, with a trunk and limbs, in summer colours. It is drawn the way a game engine draws a scene: a physical sky with the sun where it stands over the street at the chosen hour, light from that sky, sun shadows, ambient occlusion, bloom on the glows (three.js's port of Unreal Engine's bloom) and filmic tone mapping, on physically based brick, siding, stucco, storefront glass and metal. The view is drawn by the page, so it knows where it stands and looks, and every building's glow sits exactly on its walls. It walks at eye level along the streets and alleys and rises to drone (38 m) and bird (120 m) height, and the area exports as a glTF model (one node per building, its reading in the node's extras, its glow as an emissive shell) that opens in Unreal Engine 5 or Blender.`,
        `<b>Photoreal 3D ${G('A')}</b>. With a Google Maps key that has the Map Tiles API turned on, Model: Photoreal (Google) in the 3D bar puts the same walk on Google's Photorealistic 3D Tiles: the streets, houses, cars and trees as Google photographed them from the air and meshed them (the data behind Google Earth's 3D view), streamed to the browser and drawn unlit with their photographed light. The glows sit on top, each building's FEMA footprint raised to its height and set on Google's ground, which the page finds by casting rays into the mesh around the camera. Google's logo and the imagery's credits show over the view while it does. Without a key, or if Google refuses the key, the view stays on the measured model.`,
        `<b>AI detail on the map</b>. The imagery stops at zoom 19 across Louisiana, drawn from Vantor captures of 31 to 50 cm (50 cm over Baton Rouge and New Orleans, 34 cm over Shreveport; Esri has no 15 cm layer in the state; the line under the map names the capture under its centre). Past that, at zoom 20 to 22, AI detail runs each imagery tile through Real-ESRGAN (realesr-general-x4v3, a super resolution network) in TensorFlow.js on this computer's graphics card, with a 16 pixel margin from its neighbours so the joins do not show, and draws it four times finer: sharper roof edges, vents, ridges and shingle courses. Detail the network adds is inferred from the picture, not photographed, and the map says so whenever it shows. Nothing leaves the browser; the button under the map turns it off.`,
      ].map(x => `<li>${x}</li>`).join('');
      $('#scMeth', root).innerHTML = method();
      function settings() {
        const s = $('#scSet', root);
        s.innerHTML = `<div class="f"><label class="fl" for="scMinZ">Buildings appear from zoom</label><select id="scMinZ">${[16, 17, 18].map(z => `<option value="${z}"${z === CFG.minZoom ? ' selected' : ''}>${z}${z === 17 ? ' (street level, the default)' : z === 16 ? ' (wider; more requests)' : ' (closest; fewest requests)'}</option>`).join('')}</select></div>
          <div class="f"><label class="fl" for="scGr">Green at a score of</label><div class="row"><input type="range" id="scGr" min="20" max="90" step="1" value="${CFG.green}"><output id="scGrO">${CFG.green}</output></div></div>
          <div class="f"><label class="fl" for="scOr">Orange at a score of</label><div class="row"><input type="range" id="scOr" min="5" max="85" step="1" value="${CFG.orange}"><output id="scOrO">${CFG.orange}</output></div></div>
          <div class="f"><label class="fl" for="scArc">ArcGIS key (optional)</label><div class="row"><input type="password" id="scArc" autocomplete="off" spellcheck="false" placeholder="${CFG.arcgisKey ? 'Saved: ' + esc(CFG.arcgisKey.slice(0, 4)) + '…' : 'AAPK… or an access token'}"><button class="btn sm" id="scArcS">Save</button><button class="btn sm sec" id="scArcR"${CFG.arcgisKey ? '' : ' disabled'}>Remove</button></div><p class="sc-note">Routes the imagery through your own ArcGIS Location Platform account, the way Esri asks commercial apps to use it (its free tier covers two million basemap tiles a month). Without a key the public World Imagery service is used, with Esri's attribution on the map.</p></div>
          <div class="f"><label class="fl" for="scGk">Google Maps key (Street View glows, photoreal 3D)</label><div class="row"><input type="password" id="scGk" autocomplete="off" spellcheck="false" placeholder="${CFG.gKey ? 'Saved: ' + esc(CFG.gKey.slice(0, 6)) + '…' : 'AIza…'}"><button class="btn sm" id="scGkS">Save</button><button class="btn sm sec" id="scGkR"${CFG.gKey ? '' : ' disabled'}>Remove</button></div><p class="sc-note">Turns on the photoreal 3D view (turn on the Map Tiles API for the key) and the glows on Google's photos. Street View then runs on Google's Maps JavaScript API, which reports where its camera stands and looks, so every building in the picture gets a green, orange or red glow that follows the view as it turns, zooms and walks. In the Google Cloud console, turn on the Maps JavaScript API for the key and leave it unrestricted by web address (a file opened from this computer sends none; restrict it to that API instead). Google bills Street View loads past its monthly free use. Without a key Street View still plays, through Google's plain embedded player, without glows.</p></div>
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
        ['A colour is a probability', 'Two houses side by side can carry the same score and very different roofs. The model ranks where to look; the roof, the street and the owner decide.'],
        ['For field visits, not for ads', 'A reading plans where to look. The atlas\'s compliance rules forbid publishing the address, photo or name of a specific damaged home or owner without written permission (module 02), and the claim and deductible promises Louisiana law bans (modules 03 and 10); keep building level readings out of ads, pages and posts.'],
        ['A permit joins by address, else by its map point', 'A permit joins the main building at its address. When several main buildings share the address it joins the one its point falls in, else each of them in the same map square as its point (the map loads buildings and permits in squares about 530 m across) at a share of its weight (a quarter, plus three quarters split among those), since it may cover one building or all of them; a permit whose text names all the buildings or roofs, or the entire property, covers each in full. Without an address match it joins the building its point falls in or the main building nearest it within 20 m. A new construction or manufactured home permit never spreads that way: it joins by an address only one main building has (not one a nearby permit only guessed), or the building its point falls in, and dates a building only when it was filed for that building, since FEMA\'s footprints often predate the new house. A permit that reads as one for a garage, shed or other accessory alone does not date a house, an apartment building or a manufactured home. On narrow New Orleans lots a point between two houses can still land on the neighbour; the card names the permit\'s own address.'],
        ['Roof age is modeled, not recorded', 'No register records when a Louisiana roof was last replaced. Module 17 ages roofs from the year built, a calibrated roof life and the storms that reached the ZIP; Rooftop Scout runs the same model for one building. A storm reset is a share of roofs, not a fact about this one: a house in a ZIP that lost a third of its roofs to Ida either lost its roof or did not.'],
        ['Most older reroofs left no permit on file', 'Before August 1, 2025 state law left reroof permits to each parish and city, and many required none (the New Orleans reroof permit type dates from May 2025, East Baton Rouge\'s from July 2025); the two recorded older roof work only inside renovation and remodel permits. A permit on file is strong evidence; no permit is weak evidence, and weaker the older the roof.'],
        ['Year built is on file in two parishes', 'Lafayette Parish\'s tax roll carries a usable year built on about 57% of parcels, but none built after 2018, so newer Lafayette homes are aged from the ZIP; Vermilion\'s carries one on about 4%, mostly homes built 2017 to 2023. Everywhere else a building is aged from a new construction permit (New Orleans and East Baton Rouge) or the ZIP\'s housing age, so scores bunch together more than they would with the real year.'],
        ['FEMA\'s occupancy is modeled', 'USA Structures classes buildings from parcels, points of interest and imagery. A house used as an office, or a shop over apartments, can be classed either way; unclassified buildings are read by size.'],
        ['The covering is a likelihood', 'No public file records what is on a roof. Metal, tile and membranes are odds from the building\'s type and the ZIP (grade D); the imagery at its closest zoom and Street View show what is really there.'],
        ['Storm reports are points', 'A hail or wind report marks where someone measured it, not the edge of the swath. Hail swaths run for miles and miss the house next door; a roof 4 km from a report can be untouched or hit harder.'],
        ['Imagery dates differ', 'Satellite captures under one map are from different days (the line under the map names the one under its centre). Street View and Mapillary have their own dates: Street View shows its date under "View on Google Maps" and "See more dates" in Google Maps.'],
        ['The 3D view is traced from one photo', 'It is as current as the satellite photo it reads (the line under the 3D view names it), and only as complete: a roof under trees cannot be checked and keeps its recorded outline (the 3D view counts them), and the AI can misjudge an outline where shadows or a driveway blur it. Heights are not measured from the photo: a confirmed building keeps its recorded height, a redrawn one an estimate, a tree a height from its spread. Walls are not seen from above either: brick or siding is a likely look for the building\'s type, windows are placed at a typical spacing, doors face the nearest street or alley. Raised houses on piers are drawn on the ground. The AI needs a download of 14 to 40 MB once, and takes seconds on a graphics card, a few minutes on a processor; the view is usable meanwhile. Google photos, one click away, show the street as it was photographed.'],
        ['AI detail is inferred, not photographed', 'Past zoom 19 the map shows what Real-ESRGAN draws from the picture at its closest zoom: edges it sharpens are there, but fine texture it adds is its best guess. Judge a roof\'s wear, missing shingles or a tarp on the imagery at zoom 19 or in Street View; turn AI detail off to see the plain enlargement.'],
        ['Photoreal 3D is Google\'s capture', 'Google\'s mesh is from its own flights, of its own date, and melts thin things (wires, poles, fences) into lumps; Google does not publish when it was flown. The glows on it are still the FEMA footprints, so a building\'s glow can sit a little off a mesh that leans.'],
        ['A glow is a drawing, not a detection', 'Each glow is the building\'s FEMA footprint raised to its FEMA height (or a height for its type) and drawn from the panorama\'s own camera position and direction. Trees, fences and nearer buildings are not cut out of it, and a footprint or a height a few meters off moves its edge by as much. The colour is the building\'s reading, as on the map.'],
        ['Street View stands where Google drove', 'The view is aimed from the nearest point of the building\'s own street. Where Google\'s car did not pass (a private drive, a new street, a camp road) the player picks the nearest picture it has, which can be on the next street; turn, step, or walk with the arrows in the picture.'],
      ], ['Caveat', 'Why it matters']);
      $('#scGap', root).innerHTML = judgList([
        ['The roof itself', 'No public file lists a roof\'s covering, age, layers or condition. An insurer\'s inspection, a roofer\'s report, a permit or the owner\'s answer is the only record.'],
        ['Insurance claims', 'Which roofs had a wind or hail claim, and which were paid, sits with the insurers and Louisiana Citizens; FEMA\'s registrations are counted by ZIP in module 02, not by house.'],
        ['Permits outside New Orleans and East Baton Rouge', 'Jefferson, St. Tammany, Lafayette, Caddo, Calcasieu and the other parishes keep their own permit files; since Act 239 every reroof is permitted somewhere, but only these two publish a live open feed the atlas can read.'],
        ['Owners and tenants', 'Who owns a building and who lives in it is left out on purpose: this module reads roofs, not people. The permit files carry owner names; the module never asks for them.'],
      ]);
      $('#scSrc', root).innerHTML = srcRows([
        ['Satellite imagery', 'Esri World Imagery: Vantor Vivid, Vivid Advanced and Vivid Mosaic Metro satellite (31 to 50 cm captures); no finer aerial layer in Louisiana', 'A', 'captures of 2024 to 2026 across most of Louisiana (Baton Rouge: January 16, 2026; New Orleans: November 12, 2025; Shreveport: October 11, 2025)', 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9'],
        ['Buildings', 'FEMA USA Structures (Oak Ridge National Laboratory): footprints, occupancy, height, address', 'C', 'current release', 'https://gis-fema.hub.arcgis.com/pages/usa-structures'],
        ['Year built', 'Lafayette and Vermilion parish tax parcels on ArcGIS Online (the parish rolls in the Regrid parcel schema): year built, address, tax year', 'A', 'Lafayette refreshed November 19, 2024, tax years 2021 to 2023, a usable year built on about 57% of parcels (another 13% carry an 1860 placeholder the scout ignores) and none built after 2018; Vermilion refreshed April 29, 2025, tax year 2025, a year built on about 4% of parcels, mostly homes built 2017 to 2023', 'https://services1.arcgis.com/Brg1qbmzmFn7JtpX/arcgis/rest/services/Parish_Parcels__All_/FeatureServer'],
        ['New Orleans permits', 'City of New Orleans Open Data, permits (rcm3-fn58): residential reroofing, renovations with roof work, new construction', 'A', '2012 on, reroof permits from May 2025, updated nightly', 'https://data.nola.gov/d/rcm3-fn58'],
        ['East Baton Rouge permits', 'East Baton Rouge Parish Open Data, building permits (7fq7-8j7r): Re-Roof, remodels with roof work, new buildings, manufactured homes', 'A', '2011 on (with map points from 2012), Re-Roof permits from July 2025, updated daily', 'https://data.brla.gov/d/7fq7-8j7r'],
        ['Hail, wind and tornado reports', 'NOAA Storm Events (the atlas\'s 2016 to 2026 points: hail by size, thunderstorm wind by speed, tornadoes by EF rating)', 'A', 'compiled ' + esc(META.compiled || ''), 'https://www.ncdc.noaa.gov/stormevents/'],
        ['Storm resets and roof life', 'The atlas: module 17\'s storm driven roof replacements by ZIP and year, 2000 to 2026 (FEMA verified roof and wind damage, or NHC best track footprints), and module 02\'s ZIP storm footprints from 1992 at its FEMA fitted damage curve; module 17\'s Weibull roof life calibrated to the 2023 American Housing Survey; ZIP housing age (ACS)', 'B', 'compiled ' + esc(META.compiled || ''), ''],
        ['Streets', 'U.S. Census Bureau TIGERweb, transportation layers', 'A', 'current', 'https://tigerweb.geo.census.gov/'],
        ['Address search', 'Esri World Geocoding Service (single searches, nothing stored)', 'A', 'live', 'https://www.esri.com/'],
        ['Street View', 'Google Street View in the map card, in place of the satellite map: the Maps JavaScript API with your key (with the glows), or Google\'s plain embedded player without one; and Google Maps in its own tab', '', 'live', 'https://developers.google.com/maps/documentation/javascript/streetview'],
        ['Street photos', 'Mapillary API v4, with your token (CC BY-SA 4.0)', '', 'live', 'https://www.mapillary.com/developer/api-documentation'],
        ['Streets and alleys (3D view)', 'OpenStreetMap through the public Overpass API servers (overpass-api.de, run by FOSSGIS, then Kumi Systems\' and VK\'s when it does not answer), © OpenStreetMap contributors (ODbL); the Census TIGER file when none answers or OpenStreetMap has no streets there', 'B', 'live', 'https://www.openstreetmap.org/copyright'],
        ['3D drawing', 'three.js r186 (MIT), carried in the file, with its sky, ambient occlusion (GTAO), bloom (a port of Unreal Engine\'s) and glTF exporter', '', '', 'https://threejs.org/'],
        ['Roofs and trees (3D view)', 'Traced by AI from the newest Esri World Imagery photo of 2024 or later: SlimSAM (Segment Anything, Apache-2.0) from Hugging Face, run by ONNX Runtime Web 1.30 (MIT) on the graphics card or the processor; the building outlines it checks are FEMA\'s', 'B', 'the newest capture at each place (Baton Rouge: Vantor, January 16, 2026)', 'https://huggingface.co/Xenova/slimsam-77-uniform'],
        ['Ground height (photoreal view)', 'USGS 3D Elevation Program bare earth, from the National Map elevation service; NGS GEOID18 heights to set it under Google\'s mesh', 'A', 'the newest survey at each place', 'https://www.usgs.gov/3d-elevation-program'],
        ['Photoreal 3D (with your key)', 'Google Photorealistic 3D Tiles through the Map Tiles API (tile.googleapis.com), streamed with 3DTilesRendererJS (NASA-AMMOS, Apache-2.0) and decoded with Draco; Google\'s logo and data credits show over the view', '', 'live', 'https://developers.google.com/maps/documentation/tile/3d-tiles'],
        ['AI detail (map, zoom 20 to 22)', 'Real-ESRGAN realesr-general-x4v3 (Xintao Wang and contributors, BSD-3-Clause), run in TensorFlow.js 4.22 (Apache-2.0) on the browser\'s WebGL; its weights carried in the file', '', 'inferred', 'https://github.com/xinntao/Real-ESRGAN'],
        ['Materials (3D view)', 'CC0 photo scanned textures from Poly Haven (brick, siding, stucco, metal, asphalt, concrete, grass, bark, shingle) and ambientCG (leaves), carried in the file', '', '', 'https://polyhaven.com/'],
      ]);

      /* ---------- the map's events and the first view ---------- */
      const saveView = debounce(() => { const c = map.getCenter(); CFG.view = { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), z: map.getZoom() }; saveCfg(); }, 800);
      map.on('zoomend', () => { paintHeat(); restyleAll(); });
      map.on('moveend', () => { if (viewMode !== 'map' || root.hidden || !host.clientWidth) return; viewBounds = map.getBounds(); load(); refreshSoon(); imgInfo(); saveView(); });   /* a hidden map (another mode, or another tab) reports no view of its own */
      map.on('mouseout', hideTip);
      BUS.on('theme', () => { if (self.mounted) { paintHeat(); restyleAll(); } });
      map.attributionControl.addAttribution('Data: FEMA, U.S. Census, NOAA, New Orleans, East Baton Rouge, Lafayette and Vermilion Parishes');
      if (CFG.view) map.setView([CFG.view.lat, CFG.view.lon], CFG.view.z); else map.fitBounds(LA_BOUNDS, { padding: [10, 10] });
      $('#scSv', root).innerHTML = '<p class="sc-empty">Pick a building, or any point at street level, and Street View opens from the road in front of it, aimed at the building.</p>';
      paintHeat(); detail(); status(); refresh(); load(); imgInfo();
      /* a resize keeps the centre where it is; a collapsed map (the tab hidden) is left alone, so leaving the tab moves nothing */
      if (window.ResizeObserver) new ResizeObserver(() => { if (host.clientWidth && host.clientHeight) map.invalidateSize({ pan: true }); }).observe(host);

      /* ---------- what other code may call ---------- */
      self.api = {
        zoomZip, goTo: (la, lo, z) => { map.setView([la, lo], z || 19); pendingPick = { lat: la, lon: lo }; setTimeout(tryPending, 50); },
        map: () => map, ai: () => ({ on: aiOn(), avail: aiAvail(), layer: !!AI.layer, parentZoom: aiPz(), done: AI.done, queued: AI.queue.length, running: AI.running, ms: AI.ms, err: AI.err, cached: AI.cache.size }), buildings: () => [...B.values()], pick: id => pick(id, { pan: true }), d3: () => d3, open3D: t => open3D(t), glows: () => GM.hits.map(h => ({ id: h.b.id, d: h.d, box: [h.x0, h.y0, h.x1, h.y1] })), sv: () => ({ mode: svMode, live: GM.live, cam: GM.cam, failed: GM.failed, n: GM.n, target: svTarget && svTarget.b ? svTarget.b.id : null }), read, roofOf, addrParts, rstate, stormsAt, eventsNear, permitW, aim, svURL, status: () => ({ tiles: [...T.values()].map(t => ({ k: t.k, st: t.st, n: t.ids.size })), queued: Q.list.length, running: Q.run, errors: errors.slice() }),
      };
      self.version = VERSION;
    },
    /* a pan or zoom that ended while the tab was hidden was ignored: replay it on return (outside map mode it is ignored again) */
    onShow() { const m = this.api && this.api.map && this.api.map(); if (m) setTimeout(() => { m.invalidateSize({ pan: true }); m.fire('moveend'); }, 0); },
    receive(p) { if (!p || typeof p !== 'object' || !this.api) return; if (typeof p.zip === 'string' && ZPI[p.zip]) this.api.zoomZip(p.zip); else if (isN(p.lat) && isN(p.lon)) this.api.goTo(+p.lat, +p.lon, isN(p.zoom) ? clamp(+p.zoom, 7, 22) : 19); },
    fromRoute(arg) { const a = String(arg || '').trim(); if (/^\d{5}$/.test(a)) return this.receive({ zip: a }); const m = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,(\d+))?$/.exec(a); if (m) this.receive({ lat: +m[1], lon: +m[2], zoom: m[3] ? +m[3] : 19 }); },
  });
})();
</script>
