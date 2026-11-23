<script id="scout-js">
/* ==== rooftop scout ==== */
/* Module 18, Rooftop Scout, of California Roofer Guru: the atlas's heatmaps laid over commercial satellite imagery, down
   to the single roof, for California and only California.
   The ZIP heatmap of any layer in the shared catalog (the same LAYERS modules 01, 04, 05 and 06 draw) sits on Esri World
   Imagery: Vantor satellite imagery of 31 to 50 cm at the closest zoom across most of the state, finer county aerials
   where Esri carries them (Santa Clara County, Santa Rosa, San Bernardino County). At street level every building in view
   is fetched from FEMA's USA Structures inventory and joined to what California's public records say about it:
     its parcel (year built, use, situs address) from the county assessor's public layer where one carries a year built:
       Los Angeles, San Diego (a two digit effective year), Orange, Riverside (which also records the roof covering),
       Santa Clara, Contra Costa, San Francisco, San Joaquin, Sonoma and Ventura; an address and use only in Alameda,
       Sacramento, San Mateo and Placer; nothing in San Bernardino, Fresno or Kern, where the ZIP's housing age stands in
       and the card says so;
     re-roof permits where a city publishes them: the City of Los Angeles (1996 on), Los Angeles County's unincorporated
       areas and contract cities (2018 on), San Francisco (with its re-roof flag), the City of Sacramento (by parcel
       number, with the covering and the squares) and, in part, San Jose;
     CAL FIRE's record at the site: the Fire Hazard Severity Zone the building stands in, the fire perimeters since 1950
       round it, and the damage inspection of the building itself where a fire reached it (which also records its roof);
     the Energy Commission's building climate zone, for the cool roof rules a re-roof must meet (Title 24, Part 6).
   Each building is then read by the atlas's own models: the roof it most likely carries (statewide 62 percent shingles,
   27 percent tile, 5 percent wood on single family homes, and 62 percent tile on those built 2000 to 2020: the 2020
   Residential Energy Consumption Survey), how old that roof most likely is (module 17's roof life, with tile aged by its
   underlayment, and wildfire rebuilds), how likely it is to need a replacement, a tile lift and relay, a repair or
   wind, rain or fire work, and which of the thirteen service lines that is.
   Green: likely to need the work. Orange: maybe. Red: not likely. A field check from the imagery overrides the model.
   Live Google Street View plays inside the map card, aimed from the street at the building, in place of the satellite map:
   Google's terms (Maps Platform 3.2.3(e)) keep Street View imagery and a non-Google map off the same screen, so the card
   switches between them. With no key at all, the Street view (3D) rebuilds the neighborhood from open data (FEMA
   buildings, Esri imagery, OpenStreetMap streets and alleys) and every building glows in its colour, exactly, because the
   page draws the scene itself; it walks the streets and alleys and rises for the roofs. It is traced from the newest
   satellite photo Esri serves for the place when that photo is from 2024 or later: an AI model (SlimSAM, Segment
   Anything, run on this computer by ONNX Runtime Web) checks every building on record against the photo, redraws the
   ones whose roofs changed, and outlines every tree crown. The area exports as a glTF model for Unreal Engine 5 or
   Blender. With a Google Maps key that has the Map Tiles API, the same 3D view can stand on Google's Photorealistic 3D
   Tiles instead. Past the imagery's finest zoom, the satellite map's AI detail runs Real-ESRGAN on this computer's
   graphics card to draw each tile four times finer, labelled as inferred. Street photos inside the side panel come from
   Mapillary when a Mapillary token is saved. Every request goes from this browser straight to a public service; nothing
   is sent anywhere else, and the keys a person saves stay in this browser.
   The Scout Engine (window.__SCOUT_E3D__, carried in the file after this script) draws the same neighborhood with its own
   WebGL2 renderer and lays roof views on the roofs round the camera: Covering, Shingle style, Thermal, Wear, Weather
   (what the rain, the atmospheric river, the wind, the snow or the smoke now set on the engine's scales would do to
   each roof), Fire (the class of roof each most likely is, the zone it stands in and its ember exposure), Solar and
   cool roof (the sun each plane takes in a year, and the cool roof rule a re-roof there must meet) and Time (the damage
   most likely to have reached each part of each roof by each of the next fifteen years). The same fifteen year outlook
   is on the building's card, with California's weather history applied to the roof: atmospheric river days by rank,
   heavy rain days, gust days at 40, 58 and 75 mph, Santa Ana or Diablo exposure, the fire zone and the fires and
   losses near it, the ground snow load, heat days, hail and salt air, each said plainly with its source, as the record
   of what has happened there and never as a forecast of an event.
   Plain script in the dashboard's own style, on the dashboard's own helpers (registerModule, mastHTML, card, callout,
   kpiHTML, dataTable, layerOptions, zipTip, qScale, legendHTML, saveFile, toCSV, store, toast). Leaflet 1.9.4 is carried
   inline beside it and kept private (window.__SCOUT_LEAFLET__), so no other module sees a global L. */
(function () {
  'use strict';
  if (typeof registerModule !== 'function' || typeof MODS === 'undefined' || typeof MODI === 'undefined' || MODI.rooftops) return;
  const LF = window.__SCOUT_LEAFLET__ || null;
  const KEY = 'rooftops', STORE = 'cg.scout.v1', CHECKS = 'cg.scout.checks.v1', VERSION = 1;
  const NUM = String(Math.max(0, ...MODS.map(m => +m.num || 0)) + 1).padStart(2, '0');
  const G0 = DATA.geo;
  const NOWD = new Date(), NOW = NOWD.getFullYear() + (NOWD.getMonth() + (NOWD.getDate() - 1) / 31) / 12, THIS_YEAR = NOWD.getFullYear();
  const TILE_Z = 16;                                                     /* buildings, parcels and permits are fetched per zoom 16 tile, about 530 m square here */

  /* ---------- public services: every one keyless and open to a browser (CORS), checked 2026-11-19 ---------- */
  const EP = {
    esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/',
    esriKey: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/',
    bldg: 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query',
    roads: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/',
    geocode: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
    revgeo: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
    mly: 'https://graph.mapillary.com/images',
    osmBldg: 'https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/OSM_NA_Buildings/FeatureServer/0/query',
    /* California Energy Commission: the sixteen building climate zones (the commission's 2015 boundary layer) */
    cz: 'https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/BuildingClimateZones_CEC_2015/FeatureServer/0/query',
    /* CAL FIRE's hosted layers: Fire Hazard Severity Zones (State Responsibility Area, in force April 1, 2024; Local
       Responsibility Area, the State Fire Marshal's map of March 24, 2025), fire perimeters since 1950, damage inspections */
    fire: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/',
    fhszS: 'FHSZSRA_23_3/FeatureServer/0/query', fhszL: 'FHSALRA25_v1_All/FeatureServer/0/query', perim: 'California_Historic_Fire_Perimeters/FeatureServer/2/query', dins: 'POSTFIRE_MASTER_DATA_SHARE/FeatureServer/0/query',
    /* re-roof permits */
    ladbs: [['https://data.lacity.org/resource/pi9x-tg5x.json', 2020], ['https://data.lacity.org/resource/dyxf-7hc4.json', 2010], ['https://data.lacity.org/resource/e67z-kt2n.json', 1996]],
    epicla: 'https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/EPIC-LA_Case_History_view/FeatureServer/0/query',
    sfp: 'https://data.sf.gov/resource/i98e-djp9.json',
    sfroll: 'https://data.sf.gov/resource/wv5m-vpq2.json',
    sacp: ['https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/BldgPermitIssued_Archive/FeatureServer/0/query', 'https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/BldgPermitIssued_CurrentYear/FeatureServer/0/query'],
    sjp: 'https://data.sanjoseca.gov/api/3/action/datastore_search_sql',
  };
  /* The county assessors' public parcel layers, by county FIPS, as tested on 2026-11-19 (ArcGIS REST, one envelope query a
     map square). yb: the year built as the layer gives it; an address and a use where it has them. A layer marked noYb
     has no year built a browser can read: it still names the building (FEMA's California footprints carry no address).
     San Francisco is a Socrata table of points (below); Riverside keeps the year and the roof covering in a second table. */
  const yr4 = v => { const y = parseInt(v, 10); return y >= 1850 && y <= THIS_YEAR + 1 ? y : null; };
  const PARCEL = {
    '06037': { n: 'Los Angeles', url: 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query', f: 'AIN,SitusAddress,SitusFullAddress,SitusCity,UseType,UseDescription,YearBuilt1,EffectiveYear1,Units1,SQFTmain1,Roll_Year',
      m: a => ({ yb: yr4(a.YearBuilt1), eff: yr4(a.EffectiveYear1), situs: a.SitusAddress || a.SitusFullAddress, city: a.SitusCity, use: a.UseDescription || a.UseType, apn: a.AIN, roll: a.Roll_Year, units: +a.Units1 || 0 }) },
    '06073': { n: 'San Diego', url: 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query', f: 'apn,situs_address,situs_pre_dir,situs_street,situs_suffix,situs_community,year_effective,nucleus_use_cd,unitqty', q: { maxAllowableOffset: 0.000005 }, two: true,
      m: a => ({ yy: /^\d{2}$/.test(String(a.year_effective || '').trim()) ? String(a.year_effective).trim() : '', situs: [a.situs_address, a.situs_pre_dir, a.situs_street, a.situs_suffix].filter(x => x != null && String(x).trim() && String(x).trim() !== '0').join(' '), city: a.situs_community, use: sdUse(a.nucleus_use_cd), apn: a.apn, units: +a.unitqty || 0 }) },
    '06059': { n: 'Orange', url: 'https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/FeatureServer/0/query', f: 'SITE_ADDRESS,ASSESSMENT_NO,YEAR_BUILT', m: a => ({ yb: yr4(a.YEAR_BUILT), situs: a.SITE_ADDRESS, apn: a.ASSESSMENT_NO }) },
    '06065': { n: 'Riverside', url: 'https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query', f: 'APN,SITUS_STREET,SITUS_CITY,CLASS_CODE', table: 'https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/80/query',
      m: a => ({ situs: a.SITUS_STREET, city: a.SITUS_CITY, use: a.CLASS_CODE, apn: a.APN }) },
    '06085': { n: 'Santa Clara', url: 'https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Parcels_Public_View/FeatureServer/0/query', f: 'APN,Year_Built,Situs_Address_Full', m: a => ({ yb: yr4(a.Year_Built), situs: a.Situs_Address_Full, apn: a.APN }) },
    '06013': { n: 'Contra Costa', url: 'https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0/query', f: 'APN,full_address_display,s_city,USE_CODE,Description,YR_BUILT,YR_HS_BLT', m: a => ({ yb: yr4(a.YR_HS_BLT) || yr4(a.YR_BUILT), situs: a.full_address_display, city: a.s_city, use: a.Description, apn: a.APN }) },
    '06077': { n: 'San Joaquin', url: 'https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0/query', f: 'APN,FULL_ADDRESS,YEAR_BUILT,STORIES,NUMBER_UNITS,DESCRIPTION,VALUE_ROLL_YEAR', m: a => ({ yb: yr4(a.YEAR_BUILT), situs: a.FULL_ADDRESS, use: a.DESCRIPTION, apn: a.APN, roll: a.VALUE_ROLL_YEAR, units: +a.NUMBER_UNITS || 0 }) },
    '06097': { n: 'Sonoma', url: 'https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer/0/query', f: 'APN,SitusFormatted1,UseCodeDescription,BuildingPrimaryYearBuilt,BuildingPrimaryEffectiveYear,BuildingPrimaryUnitCount', m: a => ({ yb: yr4(a.BuildingPrimaryYearBuilt), eff: yr4(a.BuildingPrimaryEffectiveYear), situs: a.SitusFormatted1, use: a.UseCodeDescription, apn: a.APN, units: +a.BuildingPrimaryUnitCount || 0 }) },
    '06111': { n: 'Ventura', url: 'https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/Parcels1955on/FeatureServer/6/query', url2: 'https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/ParcelsBefore1955/FeatureServer/7/query', f: 'YR_BLT', roll: 'a snapshot of May 3, 2023', m: a => ({ yb: yr4(a.YR_BLT) }) },
    '06001': { n: 'Alameda', noYb: true, url: 'https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0/query', f: 'APN,SitusAddress,SitusCity,UseCode', m: a => ({ situs: a.SitusAddress, city: a.SitusCity, apn: a.APN }) },
    '06067': { n: 'Sacramento', noYb: true, url: 'https://services1.arcgis.com/5NARefyPVtAeuJPU/arcgis/rest/services/Parcels/FeatureServer/0/query', f: 'APN,STREET_NBR,STREET_NAM,CITY,LU_GENERAL,LU_SPECIF', m: a => ({ situs: [a.STREET_NBR, a.STREET_NAM].filter(x => x != null && String(x).trim()).join(' '), city: a.CITY, use: [a.LU_GENERAL, a.LU_SPECIF].filter(Boolean).join(', '), apn: a.APN }) },
    '06081': { n: 'San Mateo', noYb: true, url: 'https://gis.smcgov.org/maps/rest/services/Common/ACTIVE_PARCELS_APN/FeatureServer/0/query', f: 'APN,SITUS_ADDR', m: a => ({ situs: a.SITUS_ADDR, apn: a.APN }) },
    '06061': { n: 'Placer', noYb: true, url: 'https://services9.arcgis.com/NENkjkswKTzMfG3A/arcgis/rest/services/County_Parcels_-_Public_View/FeatureServer/0/query', f: 'Apn,SitusAddressFull,UseCodeName', m: a => ({ situs: a.SitusAddressFull, use: a.UseCodeName, apn: a.Apn }) },
  };
  /* San Diego's assessor use code (three digits): the first digit is the group */
  function sdUse(c) { c = String(c == null ? '' : c).trim(); if (!/^\d{3}$/.test(c)) return ''; return c === '111' ? 'Single family residence' : c[0] === '1' ? (+c >= 130 ? 'Multifamily residential' : 'Residential') : c[0] === '2' ? 'Commercial' : c[0] === '3' ? 'Industrial' : c[0] === '4' ? 'Agricultural' : c[0] === '7' ? 'Institutional' : 'Use code ' + c; }
  /* counties whose assessor publishes no year built a browser can read, and no address either */
  const NO_ROLL = { '06071': 'San Bernardino', '06019': 'Fresno', '06029': 'Kern' };
  /* who publishes re-roof permits: the county decides which files a map square asks */
  const PFILE = { '06037': 'la', '06075': 'sf', '06067': 'sac', '06085': 'sj' };
  const PFILE_L = { la: 'City of Los Angeles (1996 on) and Los Angeles County\'s unincorporated areas and contract cities (2018 on)', sf: 'San Francisco Department of Building Inspection', sac: 'City of Sacramento (2016 on)', sj: 'City of San Jose (active, expired and under inspection permits only)' };

  /* ---------- settings, kept in this browser ---------- */
  const KINDS = { all: 'Every building', home: 'Homes', apt: 'Apartments and lodging', biz: 'Shops, offices and services', ind: 'Industrial and warehouses', inst: 'Schools, worship, health, government', other: 'Everything else' };
  /* green and orange cut points, set from the atlas's own roof ages (module 17): orange starts a little under the score of
     the average California roof and green a fifth above it (the method's note gives the average as the page computes it),
     so green needs evidence of an older roof or open damage, and red needs evidence of a newer one (a rebuild after a
     fire, a permit or a young building) */
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
    if (s.view && isN(s.view.lat) && isN(s.view.lon) && isN(s.view.z) && s.view.lat > G0.maxy - G0.H / G0.sx - 0.5 && s.view.lat < G0.maxy + 0.5 && s.view.lon > G0.minx - 0.5 && s.view.lon < G0.minx + G0.W / (G0.kx * G0.sx) + 0.5) o.view = { lat: +s.view.lat, lon: +s.view.lon, z: clamp(Math.round(+s.view.z), 7, 22) };
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
  const CUES = [['tarp', 'Tarp or a temporary patch', 'g'], ['missing', 'Missing, lifted or creased shingles', 'g'], ['worn', 'Worn: curling, bare spots, dark streaks or moss', 'g'], ['tile', 'Tile: broken, slipped or missing tiles, open ridge or hip mortar', 'g'], ['shake', 'Wood shakes: split, cupped or missing', 'g'], ['ponding', 'Flat roof: ponding, blisters or open seams', 'g'], ['rust', 'Metal roof: rust or backed out fasteners', 'g'], ['burn', 'Fire: scorched, melted or burned roof, or a cleared lot', 'g'], ['debris', 'Leaves or needles in the valleys and gutters', ''], ['solar', 'Solar panels on the roof (a re-roof means a detach and reset)', ''], ['new', 'New roof: clean, even colour, fresh flashing', 'r'], ['work', 'Work underway, or a dumpster in the drive', '']];

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
      const r = await fetch(url, o.post ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs(o.post), signal: ctl.signal, credentials: 'omit' } : { signal: ctl.signal, credentials: 'omit' });
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
  const CTY = Object.entries(G0.parish || G0.county || {}).map(([f, d]) => ({ fips: f, rings: pathRings(d) }));
  const CTYI = {}; CTY.forEach(c => CTYI[c.fips] = c);
  function zipAt(la, lo) {
    for (const p of ZP) if (inBox(la, lo, p.bb) && inRings(la, lo, p.rings)) return p.zip;
    let best = null, bd = 1e9; Z.forEach(z => { if (!isN(z.lat)) return; const d = meters([la, lo], [z.lat, z.lon]); if (d < bd) { bd = d; best = z.zip; } });
    return bd < 6000 ? best : null;
  }
  /* the box the atlas's map is drawn in (California with its neighbours' edges), the state's own outline, and whether a point is in the state */
  const ST_BOX = { s: G0.maxy - G0.H / G0.sx, w: G0.minx, n: G0.maxy, e: G0.minx + G0.W / (G0.kx * G0.sx) };
  const ST_BOUNDS = [[ST_BOX.s, ST_BOX.w], [ST_BOX.n, ST_BOX.e]];
  const ST_RINGS = (() => { try { return pathRings(G0.outline); } catch (e) { return []; } })();
  const ST_BB = ST_RINGS.length ? bboxOf(ST_RINGS) : [ST_BOX.s, ST_BOX.w, ST_BOX.n, ST_BOX.e];
  const inState = (la, lo) => isN(la) && isN(lo) && la >= ST_BB[0] - 0.02 && la <= ST_BB[2] + 0.02 && lo >= ST_BB[1] - 0.02 && lo <= ST_BB[3] + 0.02 && (!ST_RINGS.length || inRings(la, lo, ST_RINGS) || !!zipAt(la, lo));
  /* for the address search: the state's box, and its middle */
  const GEO_EXT = [ST_BB[1] - 0.05, ST_BB[0] - 0.05, ST_BB[3] + 0.05, ST_BB[2] + 0.05].map(v => v.toFixed(2)).join(','), GEO_MID = ((ST_BB[1] + ST_BB[3]) / 2).toFixed(2) + ',' + ((ST_BB[0] + ST_BB[2]) / 2).toFixed(2);

  /* ---------- web mercator tiles ---------- */
  const lon2x = (lo, z) => Math.floor((lo + 180) / 360 * Math.pow(2, z));
  const lat2y = (la, z) => { const r = rad(la); return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); };
  const tileBox = (z, x, y) => { const n = Math.pow(2, z), n0 = deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)))), n1 = deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)))); return { w: x / n * 360 - 180, e: (x + 1) / n * 360 - 180, n: n0, s: n1 }; };
  const env = b => [b.w, b.s, b.e, b.n].map(v => v.toFixed(6)).join(',');

  /* ---------- addresses: one key for the parcel rolls, the permit files and CAL FIRE's inspections ---------- */
  /* "200 N SPRING ST", "200 North Spring Street, Los Angeles, CA 90012", "627 E CALAVERAS ST, ALTADENA, CA 91001" and
     "1030 Larkin St Apt B" all come down to number|core name: suffixes and directions dropped, units, cities and ZIPs
     cut off. A range ("2824-26 Mission St", "2616/18 Folsom St") keys on its first number, and so does a half number
     ("1234 1/2 W 5th St": a rear unit, common in Los Angeles). A city written after the street with no comma is cut
     off when the caller names it (the parcel rolls give it in its own field). */
  const SUF = { AVENUE: 'AVE', AV: 'AVE', AVE: 'AVE', STREET: 'ST', ST: 'ST', DRIVE: 'DR', DR: 'DR', ROAD: 'RD', RD: 'RD', LANE: 'LN', LN: 'LN', COURT: 'CT', CT: 'CT', CIRCLE: 'CIR', CIR: 'CIR', BOULEVARD: 'BLVD', BLVD: 'BLVD', PLACE: 'PL', PL: 'PL', PARKWAY: 'PKWY', PKWY: 'PKWY', TRAIL: 'TRL', TRL: 'TRL', TERRACE: 'TER', TER: 'TER', HIGHWAY: 'HWY', HWY: 'HWY', FREEWAY: 'FWY', FWY: 'FWY', EXPRESSWAY: 'EXPY', EXPY: 'EXPY', WAY: 'WAY', COVE: 'CV', CV: 'CV', CROSSING: 'XING', XING: 'XING', SQUARE: 'SQ', SQ: 'SQ', POINT: 'PT', PT: 'PT', RIDGE: 'RDG', RDG: 'RDG', LOOP: 'LOOP', PATH: 'PATH', PASS: 'PASS', RUN: 'RUN', ROW: 'ROW', ALLEY: 'ALY', ALY: 'ALY', BEND: 'BND', BND: 'BND', GLEN: 'GLN', GLN: 'GLN', GROVE: 'GRV', GRV: 'GRV', HOLLOW: 'HOLW', HOLW: 'HOLW', LANDING: 'LNDG', LNDG: 'LNDG', PLAZA: 'PLZ', PLZ: 'PLZ', TRACE: 'TRCE', TRCE: 'TRCE', VIEW: 'VW', VW: 'VW', VISTA: 'VIS', WALK: 'WALK', CREEK: 'CRK', CRK: 'CRK', HILL: 'HL', HILLS: 'HLS', MEADOW: 'MDW', MEADOWS: 'MDWS', SPRINGS: 'SPGS', VALLEY: 'VLY', ESTATES: 'ESTS', CANYON: 'CYN', BRANCH: 'BR', BROOK: 'BRK', BLUFF: 'BLF', CREST: 'CRST', FIELD: 'FLD', FIELDS: 'FLDS', GARDENS: 'GDNS', HEIGHTS: 'HTS', MANOR: 'MNR', OVAL: 'OVAL', PIKE: 'PIKE', SPUR: 'SPUR', STRAVENUE: 'STRA' };
  const DIRS = { NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW', N: 'N', S: 'S', E: 'E', W: 'W', NE: 'NE', NW: 'NW', SE: 'SE', SW: 'SW' };
  const isDir = w => /^(N|S|E|W|NE|NW|SE|SW)$/.test(w), isSuf = w => Object.prototype.hasOwnProperty.call(SUF, w);
  function addrParts(s, city) {
    let t = String(s == null ? '' : s).toUpperCase().split(',')[0].replace(/^\s*(\d+)\s+\d\/\d\b/, '$1').replace(/^\s*(\d+)[A-Z]?\s*[-\/&]\s*\d+[A-Z]?\b/, '$1').replace(/\s+CA(LIFORNIA)?\s+9\d{4}(-\d{4})?\s*$/, ' ').replace(/\s+9\d{4}(-\d{4})?\s*$/, ' ');
    if (city) { const c = String(city).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); if (c && t.replace(/\s+/g, ' ').trim().endsWith(' ' + c)) t = t.replace(/\s+/g, ' ').trim().slice(0, -c.length); }
    t = t.replace(/\b(STE|SUITE|UNIT|APT|BLDG|SPC|LOT|RM|FL)\b\s*[:#.]?\s*[A-Z0-9-]*/g, ' ').replace(/#\s*[A-Z0-9-]+/g, ' ').replace(/\bSAINT\b/g, 'ST').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
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

  /* ---------- roof life: module 17's roof lives, and the wildfires that rebuilt roofs ---------- */
  const lanczos = z => { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * lanczos(1 - z)); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; };
  const MODEL = (META && META.model) || {}, ANCH = MODEL.ANCH || {};
  /* module 17's two lives: every covering but tile on one Weibull life, refitted to the American Housing Survey's West
     region; tile on the life of the underlayment under it, about 25 years by a reserve study consultant's figure and a
     trade site's (neither a test nor a field study), after which the same tile is lifted and relaid */
  const WB = MODEL.WB || { L: 22, k: 3 }, WBT = MODEL.WBT || { L: 25, k: 3 };
  /* L: mean life in years; k: Weibull shape. Shingles, wood and a house's low slope roof carry the atlas's life for
     coverings other than tile (module 17 keeps them in one cohort: no California field study of shingle or shake life
     was found); tile the underlayment's; membranes and metal buildings the atlas's commercial and multifamily lives
     (module 12); metal homes 40 years and manufactured home roofs 20 (the atlas's stated figures; their shapes are
     judgment). */
  const LIFE = {
    shingle: { L: +WB.L || 22, k: +WB.k || 3, l: 'asphalt shingles' },
    tile: { L: +WBT.L || 25, k: +WBT.k || 3, l: 'tile (the underlayment under it)' },
    wood: { L: +WB.L || 22, k: +WB.k || 3, l: 'wood shakes or shingles' },
    flat: { L: +WB.L || 22, k: +WB.k || 3, l: 'a low slope roof on a house' },
    metal: { L: 40, k: 3, l: 'metal' },
    mh: { L: 20, k: 2.5, l: 'a manufactured home roof' },
    low: { L: +ANCH.comm_life || 22, k: 3, l: 'a low slope membrane' },
    lowmf: { L: +ANCH.mf_life || +ANCH.comm_life || 22, k: 3, l: 'a low slope membrane' },
    mbldg: { L: +ANCH.comm_life || 22, k: 3, l: 'a metal building roof' },
  };
  Object.values(LIFE).forEach(p => { p.lam = p.L / lanczos(1 + 1 / p.k); });
  const mphOf = ms => Math.round(ms * 2.23694);
  /* The fire resets, exactly as module 17's cohort model made them: from 2000 on, each year's wildfire rebuild roofs in
     the ZIP (DATA.rhist, second number: the structures CAL FIRE's damage inspections record as destroyed, coming back
     as new roofs over the four years after the fire at the atlas's rebuild share), as a share of the ZIP's one unit
     roofs standing that year (today's one unit homes built before it). California has no other reset: no storm here
     replaces a neighbourhood's roofs at once. CAL FIRE's digital inspections begin in 2013, so earlier fires (Oakland
     1991, the Cedar fire of 2003, Witch 2007) reset nothing here unless the atlas's file carries them. */
  const RH0 = +MODEL.RH0 || 2000, RH = DATA.rhist || {};
  const OBK = ['o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold'];
  function standing(z, y) {
    let w = OBK.map(k => Math.max(0, +z[k] || 0)); if (!(sum(w) > 0)) w = YBK.map(k => Math.max(0, +z[k] || 0)); const W = sum(w); if (!W) return 1;
    let s = 0; w.forEach((v, i) => { const [a, b] = BINS[i], lo = i === BINS.length - 1 ? 1900 : a, hi = b + 1; s += v * clamp((y - lo) / (hi - lo), 0, 1); });
    return clamp(s / W, 0.02, 1);
  }
  const RYEARS = new Map();
  function resetsAt(zip) {
    if (RYEARS.has(zip)) return RYEARS.get(zip);
    const z = ZI[zip], rh = RH[zip], out = [];
    if (rh && z && z.roofs > 0) rh.forEach((r, i) => { const n = r ? +r[1] || 0 : 0; if (!(n > 0)) return; const y = RH0 + i, d = clamp(n / (z.roofs * standing(z, y)), 0, 0.95); if (d > 0.0005) out.push({ y, d, n }); });
    RYEARS.set(zip, out); return out;
  }
  /* repair calls a year by roof age: shaped by age (judgment) and scaled so the state's roofs, at module 17's ages, make the
     atlas's own count of paid repair jobs (the repair line's pool) */
  const REP_SHAPE = a => a < 5 ? 0.35 : a < 10 ? 0.6 : a < 15 ? 0.95 : a < 20 ? 1.35 : a < 25 ? 1.7 : 2.0;
  const REP_TARGET = META.pools && META.roofs ? clamp(META.pools.repair / META.roofs, 0.005, 0.08) : 0.027;
  const AGEH = (DATA.ts && DATA.ts.agehist) || [], AGEH_T = (DATA.ts && DATA.ts.agehist_t) || [];
  const REP_BASE = (() => { let n = 0, s = 0; AGEH.forEach((v, a) => { n += +v || 0; s += (+v || 0) * REP_SHAPE(a); }); return n && s ? REP_TARGET * n / s : REP_TARGET; })();
  const repRate = a => REP_BASE * REP_SHAPE(a);
  /* the score of the average California roof at module 17's ages (tile on its underlayment's life, every other covering on
     the shingle life, no other evidence), for the method's note on the cut points */
  const AVG_SCORE = (() => { let n = 0, s = 0; const one = (H, L0, sign) => { const S = a => Math.exp(-Math.pow(a / L0.lam, L0.k)); H.forEach((v, a) => { const w = sign * (+v || 0), p5 = 1 - S(a + 5) / S(a), rp = repRate(a); n += w; s += w * (1 - (1 - p5) * (1 - rp)); }); };
    one(AGEH, LIFE.shingle, 1); if (AGEH_T.length) { one(AGEH_T, LIFE.shingle, -1); one(AGEH_T, LIFE.tile, 1); } return n > 0 ? Math.round(s / n * 100) : null; })();
  /* The roof in place, for a clock started in year y0 at a ZIP: year by year the roof wears out on its Weibull life and is
     replaced (for tile: lifted and relaid on new underlayment), and every fire year resets the share of the surviving
     roofs the fire's rebuilds made new. Out come the chance the roof is still the first one, 15 or older, 20 or older,
     25 or older, replaced within five years (age driven) and within twelve months, a repair call within twelve months,
     its mean age, and the fire years today's roof most likely dates from. */
  const HMAX = 125, SMEMO = new Map();
  function rstate(mat, zip, y0) {
    const mk = mat + '|' + zip + '|' + y0; if (SMEMO.has(mk)) return SMEMO.get(mk);
    const p = LIFE[mat] || LIFE.shingle, lam = p.lam, kk = p.k, S = a => Math.exp(-Math.pow(a / lam, kk));
    const T = clamp(THIS_YEAR - y0, 0, HMAX), y00 = THIS_YEAR - T, sm = new Map(resetsAt(zip).map(s => [s.y, s]));
    let dist = new Float64Array(T + 2); dist[0] = 1; const coh = [];
    for (let i = 1; i <= T; i++) {
      const y = y00 + i, nd = new Float64Array(T + 2); let rep = 0;
      for (let a = 0; a < i; a++) { const v = dist[a]; if (!v) continue; const surv = S(a + 1) / S(a); nd[a + 1] += v * surv; rep += v * (1 - surv); }
      nd[0] += rep;
      coh.forEach(c => { c.m *= S(c.a + 1) / S(c.a); c.a++; });
      const st = sm.get(y);
      if (st && st.d > 0) { const d = clamp(st.d, 0, 0.95); let moved = 0; for (let a = 1; a <= i; a++) { const v = nd[a] * d; nd[a] -= v; moved += v; } nd[0] += moved; coh.forEach(c => { c.m *= 1 - d; }); if (moved > 0.002) coh.push({ y, st, m: moved, a: 0 }); }
      dist = nd;
    }
    let pOld15 = 0, pOld20 = 0, pOld25 = 0, age = 0, p5 = 0, p1 = 0, rep = 0;
    for (let a = 0; a <= T; a++) { const v = dist[a]; if (!v) continue; const s0 = S(a); if (a >= 15) pOld15 += v; if (a >= 20) pOld20 += v; if (a >= 25) pOld25 += v; age += v * a; p5 += v * (1 - S(a + 5) / s0); p1 += v * (1 - S(a + 1) / s0); rep += v * repRate(a); }
    const fires = coh.filter(c => c.m > 0.01).sort((a, b) => b.m - a.m).slice(0, 3).map(c => ({ y: c.y, share: c.m }));
    const o = { pOrig: dist[T], pOld15, pOld20, pOld25, p5: clamp(p5, 0, 1), p1: clamp(p1, 0, 1), rep, age, t: T, fires, dist };
    SMEMO.set(mk, o); return o;
  }
  const ST_KEYS = ['pOrig', 'pOld15', 'pOld20', 'pOld25', 'p5', 'p1', 'rep', 'age', 't'];
  const ZERO = { pOrig: 0, pOld15: 0, pOld20: 0, pOld25: 0, p5: 0, p1: 0, rep: 0, age: 0, t: 0, fires: [] };
  function mixStates(list) {
    const o = {}; ST_KEYS.forEach(k => o[k] = 0); let W = 0; const sy = new Map();
    list.forEach(([s, w]) => { W += w; ST_KEYS.forEach(k => o[k] += s[k] * w); (s.fires || []).forEach(x => { const e = sy.get(x.y) || { y: x.y, share: 0 }; e.share += x.share * w; sy.set(x.y, e); }); });
    if (W > 0) { ST_KEYS.forEach(k => o[k] /= W); sy.forEach(e => e.share /= W); }
    o.fires = [...sy.values()].sort((a, b) => b.share - a.share).slice(0, 3); return o;
  }

  /* ---------- when a building was built, when its year is not on file ---------- */
  /* The ZIP's ACS year built mix (the same ten bins module 17 draws; for a house the one unit homes by decade, where the
     data carries them), sharpened for a house by its footprint: an old neighborhood's big footprint is more likely a
     rebuild, a small one more likely original. The footprint medians are a judgment call, set wide (a log spread of
     0.38) so they lean, not decide. This is what stands in wherever no assessor publishes a year built. */
  const BINS = [[2020, 2025], [2010, 2019], [2000, 2009], [1990, 1999], [1980, 1989], [1970, 1979], [1960, 1969], [1950, 1959], [1940, 1949], [1905, 1939]];
  const BIN_L = ['2020 or later', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', 'before 1940'];
  const YBK = ['yb20', 'yb10', 'yb00', 'yb90', 'yb80', 'yb70', 'yb60', 'yb50', 'yb40', 'ybold'];
  const FOOT = [2300, 2400, 2450, 2300, 2050, 1800, 1550, 1250, 1100, 1250];
  const binOf = y => { for (let i = 0; i < BINS.length; i++) if (y >= BINS[i][0]) return i; return BINS.length - 1; };
  function ybPrior(b) {
    const z = b.z; let w = z ? YBK.map(k => Math.max(0, +z[k] || 0)) : null;
    if (z && (b.cls === 'sf' || b.cls === 'garage' || b.cls === 'shed')) { const o1 = OBK.map(k => Math.max(0, +z[k] || 0)); if (sum(o1) > 0) w = o1; }
    if (!w || !(sum(w) > 0)) w = Array.isArray(META.yb) ? META.yb.map(v => +v || 0) : BINS.map(() => 1);
    if (b.cls === 'sf' && b.sqft > 300) { const ls = Math.log(b.sqft); w = w.map((v, i) => v * Math.exp(-Math.pow(ls - Math.log(FOOT[i]), 2) / (2 * 0.38 * 0.38))); }
    const s = sum(w) || 1; return w.map(v => v / s);
  }
  const sampleYears = i => { const [a, b] = BINS[i]; return i === BINS.length - 1 ? [1915, 1928, 1937] : i === 0 ? [2021, 2022, 2024] : [a + 1, Math.round((a + b) / 2), b - 1]; };

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

  /* ---------- California's weather and fire record at a ZIP: the hazard columns of the page's data ---------- */
  /* One place names every hazard column the module reads (the first name present wins; the second names are the
     data build's stand-ins from before the hazard job's schema was final). Days are days a year unless said.
       ar1..ar5   atmospheric river days by CW3E rank at the ZIP's latitude on the coast (the ERA5 landfall catalog)
       rd1, rd2   days with an inch and with two inches of rain (GHCN-Daily, 1996 to 2025); rainIn the 1991 to 2020 normal
       g40, g58, g75   days with a gust of 40, 58 and 75 mph at the nearest screened station (gustSt, gustKm away)
       sa         Santa Ana, Diablo or sundowner days (saKind names which)
       fhszVH, fhszH, fhszM   percent of the ZIP's area in each Fire Hazard Severity Zone; burn the percent inside a
                  fire perimeter since 1950; fireN the perimeters that touch it; dest, dmg, nodmg the structures CAL FIRE's
                  inspections record as destroyed, damaged and undamaged there (2013 to 2025)
       snow       ASCE 7-22 ground snow load, pounds a square foot; elev metres
       h100, h110 days at 100 F and 110 F; hd1 days with one inch hail within 25 miles; coast km to salt water */
  const HCOL = {
    ar1: ['ar1d'], ar2: ['ar2d'], ar3: ['ar3d'], ar4: ['ar4d'], ar5: ['ar5d'], arD: ['ar_d', 'ar_days'], arN: ['ar_n'], ar3n: ['ar3_n'], arMax: ['ar_max'],
    rainIn: ['rain_in'], rd1: ['rain_d1', 'rd1'], rd2: ['rain_d2', 'rd2'], rainRec: ['rain_rec_in'],
    g40: ['g40', 'wd40'], g58: ['g58', 'wd58'], g75: ['g75', 'wd75'], gustMax: ['gust_max'], gustKm: ['gust_km'],
    sa: ['sa_d', 'sa_days', 'sa_n', 'off_d'],
    fhszVH: ['fhsz_vh'], fhszH: ['fhsz_high'], fhszM: ['fhsz_mod'], fhszHV: ['fhsz_hv', 'fhsz_sh'], burn: ['burn_sh'], fireN: ['fire_n'], fireLastYr: ['fire_last_yr', 'lastfire'], fireBigYr: ['fire_big_yr'], fireBigAc: ['fire_big_ac'],
    dest: ['dins_dest', 'fire_dest'], dmg: ['dins_dmg', 'fire_dmg'], nodmg: ['dins_nodmg'], worstYr: ['dins_worst_yr'], worstDest: ['dins_worst_dest'],
    snow: ['snow_psf', 'pg_psf', 'snow_pg'], snow20: ['snow20_psf', 'pg20_psf'], elev: ['elev_pt_m', 'elev_m', 'elev_mean_m'],
    h90: ['h90'], h100: ['h100', 'heat100'], h110: ['h110', 'heat110'], tjul: ['tjul'],
    hd1: ['hd1', 'hail_d1'], hd175: ['hd175'], coast: ['coast_km'],
  };
  const HTXT = { arMaxDate: ['ar_max_date'], gustSt: ['gust_st'], gustMaxDate: ['gust_max_date'], saKind: ['sa_kind', 'sa_type', 'off_kind'], fireLast: ['fire_last'], fireBig: ['fire_big'], worst: ['dins_worst'], rainSt: ['rain_st'], rainRecDate: ['rain_rec_date'], fhszResp: ['fhsz_resp'], heatSt: ['heat_st'] };
  const wxCol = (z, k) => { if (!z) return null; const a = HCOL[k] || [k]; for (let i = 0; i < a.length; i++) { const v = z[a[i]]; if (v != null && v !== '' && isN(+v)) return +v; } return null; };
  const wxTxt = (z, k) => { if (!z) return ''; const a = HTXT[k] || [k]; for (let i = 0; i < a.length; i++) { const v = z[a[i]]; if (v != null && v !== '') return String(v); } return ''; };
  /* the ZIP's share of area in a High or Very High zone, from whichever columns the data carries */
  const fhszHV = z => { const a = wxCol(z, 'fhszVH'), b2 = wxCol(z, 'fhszH'); return a != null || b2 != null ? (a || 0) + (b2 || 0) : wxCol(z, 'fhszHV'); };
  /* the state's mean of a hazard column over its one unit roofs: what "more than most of California" is measured against */
  const WXMEAN = new Map();
  function wxMean(k) { if (WXMEAN.has(k)) return WXMEAN.get(k); let s = 0, n = 0; Z.forEach(z => { const v = wxCol(z, k), w = +z.roofs || 0; if (v != null && w > 0) { s += v * w; n += w; } }); const m = n > 0 ? s / n : null; WXMEAN.set(k, m); return m; }
  /* which columns the page's data really has, for the method's note and the tests */
  const WXHAS = k => Z.some(z => wxCol(z, k) != null);

  /* ---------- the reports around each building: the atlas's located weather reports of the last three years ---------- */
  /* Hail of an inch or more, thunderstorm wind of 50 knots (58 mph) or more and tornadoes of EF1 or more, from the atlas's
     located reports (DATA.pts: NOAA Storm Events and the Weather Service's local storm reports), indexed on a grid of
     0.05 degree cells. California's damaging wind is mostly not thunderstorm wind: the offshore wind and winter storm
     days are counted at the ZIP (the gust days above), not here. */
  const EVY = 3.2;
  const kt2mph = kt => Math.round(kt * 1.15078);
  const EVS = (typeof PTS !== 'undefined' && Array.isArray(PTS) ? PTS : []).map(p => ({ lat: +p.lat, lon: +p.lon, k: +p.k, mag: +p.mag, y: +p.y, m: +p.m, dw: p.dw, h: p.h, t: +p.y + ((+p.m || 6) - 0.5) / 12 }))
    .filter(p => isN(p.lat) && isN(p.lon) && NOW - p.t <= EVY && NOW - p.t >= -0.1 && ((p.k === 0 && p.mag >= 1) || (p.k === 1 && p.mag >= 50) || (p.k === 2 && p.mag >= 1)));
  const EVG = new Map(); EVS.forEach(p => { const k = Math.floor(p.lat * 20) + ':' + Math.floor(p.lon * 20); if (!EVG.has(k)) EVG.set(k, []); EVG.get(k).push(p); });
  function eventsNear(la, lo) {
    /* a cell is 5.6 km north to south but only 4.1 to 4.7 km east to west at California's latitudes, so two cells each way east and west */
    const out = [], i0 = Math.floor(la * 20), j0 = Math.floor(lo * 20);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 2; j <= j0 + 2; j++) (EVG.get(i + ':' + j) || []).forEach(p => { const km = meters([la, lo], [p.lat, p.lon]) / 1000; if (km <= 5) out.push(Object.assign({ km, ago: NOW - p.t, dir: compass(bearing([la, lo], [p.lat, p.lon])) }, p)); });
    return out.sort((a, b) => a.ago - b.ago || a.km - b.km);
  }
  /* the chance a report's hail or wind damaged a roof enough for a roofer, before distance and time (judgment) */
  const hailDmg = in_ => in_ >= 2.5 ? 0.28 : in_ >= 1.75 ? 0.16 : in_ >= 1.25 ? 0.08 : 0.04;
  const windDmg = e => e.k === 1 ? (e.mag >= 65 ? 0.08 : 0.03) : e.mag >= 3 ? 0.6 : e.mag >= 2 ? 0.35 : 0.15;
  /* damage still open after a report: claims settle and roofs are fixed within a year or two */
  const recency = ago => ago <= 1 ? 1 : ago <= 2 ? 0.55 : ago <= 3.2 ? 0.3 : 0;
  const evLabel = e => e.k === 0 ? `${D(e.mag, 2).replace(/0$/, '')} inch hail` : e.k === 1 ? `${kt2mph(e.mag)} mph thunderstorm wind` : `an EF${e.mag} tornado`;
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
     a lean to or an attached shed) on any permit but a reroof permit.
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
  const PW_REPL = new RegExp(String.raw`(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} (?:ROOF )?)\bRE[- ]?ROOF(ING|ED)?\b(?! (?:OF |ON |AT |FOR |TO )?(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b(?! (?:AND|&|PLUS)\b))|\bRE[- ]?SHINGL|(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} )(?<!\b(?:SPOT|SOME|MINOR|SMALL|FEW|ISOLATED|LOCALI[SZ]ED) (?:(?:SLATE|TILE|SHINGLE|METAL|ASPHALT|CLAY) ){0,2})\bROOF(ING)? (SHINGLE |TILE |SLATE )?REPLACE(MENT|D)?\b(?! (?:OF |ON |AT |FOR |TO )(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b(?! (?:AND|&|PLUS)\b))|\bROOF(ING)? RE-?INSTALL\w*|${PW_BEHIND}\bROOF(ING)? (REMOVAL|TEAR ?-?OFF)\b|\b(REPLAC\w*|NEW|REMOV\w*) (THE |EXISTING )?ROOF DECK(ING|S)?,? (AND |& )?(\w+ ){0,3}(SHINGLES|ROOF(ING)?)\b|${PW_BEHIND}\b(REPLAC(E|ED|ES|ING|EMENT OF)|NEW|REMOV(E|AL|ING)( AND REPLACE| & REPLACE| OF)?|CHANG(E|ED|ING)( OUT)?|R ?[\/&] ?R) ${PW_TOK}${PW_ROOFW}|\bTEAR(ING)? ?-?OFF\b|DOWN TO THE DECK|EXPOSE (THE )?DECK|\bTPO\b|MODIFIED BITUMEN|\bMOD(IFIED)? BIT\b|SINGLE.PLY|\bROOF(ING)? SYSTEM\b|^ROOFING\b(?!:? (REPAIRS?|LEAKS?|PATCH))|(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} (?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)(?<!\b(?:NO|NONE OF|NO (?:PART|PORTION|SECTION) OF|NOTHING (?:ON|OF)) (?:(?:EXISTING|THE|MAIN) )?(?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)\bROOF(?:ING|S)? (?:(?:ALSO |STILL )?(?:WILL|SHALL|MUST|IS|ARE) (?:ALSO )?BE(?:ING)?|(?:HAS|HAVE|NEEDS?|IS|ARE) TO BE|TO BE|BEING) (?:(?:COMPLETELY|ENTIRELY|FULLY|TOTALLY) )?(?:(?:REMOVED|TORN OFF|STRIPPED) (?:AND|&) )?REPLACED\b(?!,? \(?(?:AS (?:NEEDED|NECESSARY|REQUIRED(?! BY))|WHERE|IF|(?:ONLY )?WHEN (?:NEEDED|NECESSARY|REQUIRED)|ONLY (?:WHERE|IF|AS (?:NEEDED|NECESSARY|REQUIRED(?! BY)))\b|IN (?:THE )?(?:(?:DAMAGED|AFFECTED|DETERIORATED|ROTTED|ROTTEN|LEAKING|SOME|VARIOUS|SEVERAL|CERTAIN|BAD|WORN) )?(?:AREAS?|PLACES?|SECTIONS?|SPOTS?|LOCATIONS?)\b|IN[- ]KIND WHERE|AT (?:THE )?(?:DAMAGED|AFFECTED|LEAK)|AT A LATER DATE|IN THE FUTURE))(?! (?:OF|ON|AT|FOR|TO|OVER|ABOVE) (?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b(?! (?:AND|&|PLUS) (?!(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)|(?:,? (?:(?:AND|&|PLUS) )?(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)*(?:,|,? (?:AND|&|PLUS)|,? AS WELL AS|,? ALONG WITH) (?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*(?:MAIN |ORIGINAL |PRIMARY )?(?:HOUSE|HOME|RESIDENCE|DWELLING)S?\b(?=\s*(?:[.;,)]|$)|,? (?:AND|&|PLUS) (?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)(?!(?:,? (?:(?:AND|&|PLUS) )?(?:(?:THE|A|AN|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*${PW_ACCN}\b)*(?:(?: (?:AND|&|PLUS))?(?: (?!(?:WHICH|THAT|WITH|USING|IN|OF|PER|AS|BY|FOR|FROM|DUE|AFTER|UNDER|INCLUDING|ONLY|TO|AND|PLUS)\b)[A-Z]+){1,2})? (?:(?:IS|ARE|WILL|SHALL|MUST|NEEDS?|HAS|HAVE) (?:(?:ALSO|STILL|NOT|TO) )?(?:BE|BEEN|BEING|NOT|REMAIN|STAY)\b|TO (?:BE|REMAIN|STAY|GET|RECEIVE)\b|BEING\b|NOT\b|NEEDS?\b|GETS?\b|REMAINS?\b|STAYS?\b|(?:RE)?PAINT(?:ED|ING)?\b|STAIN(?:ED|ING)?\b|(?:PRESSURE|POWER)[- ]?WASH(?:ED|ING)?\b|REPAIRED\b))))|\b(RE-?INSTALL\w*|DETACH AND RESET)\b[^.;•]{0,60}?\b(ROOF(ING|S)?|SLATES?|TILES?|SHINGLES|SOLAR|FLASHING)\b`);
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
     or an attached shed, or the first clause names a lean to, an attached shed or a rear addition as what the work is
     on; never when the text names the whole roof or the house's roof, or lists the house with the part ('house and new addition
     roof replacement') */
  const PW_PARTT = new RegExp(String.raw`\b(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)? (?:WORK|REPLACEMENT|REPAIRS?|SYSTEM)|(?:SECTION|PORTION|PART|AREA)S? OF (?:THE )?(?:\w+ )?ROOF(?:ING|S)?)\b(?: ONLY)? (?:ON |OVER |AT |OF |FOR |TO |ABOVE )?(?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S?\b(?! OF\b)|\b(?:NEW|REPLAC\w*|REMOV\w*|INSTALL\w*|CONSTRUCT\w*|BUILD|REBUILD\w*|REPAIR\w*|EXTEND\w*|CHANG\w*|TEAR\w*(?: OFF)?|RECOVER\w*|RE-?FRAM\w*)(?:/\w+)? (?:(?:THE|A|AN|EXISTING|OLD|NEW|FLAT|METAL|SHINGLE|TIN|CORRUGATED|GABLE|PITCHED|HIP|SHED|ASPHALT|SLOPED|REAR|SIDE|DAMAGED|LEAKING) ){0,3}ROOF(?:ING|S)?\b (?:ON |OVER |AT |OF |FOR |TO |ABOVE )?(?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S?\b(?! OF\b)|\b(?:NEW|REPLAC\w*|REMOV\w*|INSTALL\w*|CONSTRUCT\w*|BUILD|REBUILD\w*|REPAIR\w*|EXTEND\w*|CHANG\w*|TEAR\w*(?: OFF)?|RECOVER\w*|RE-?FRAM\w*)(?:/\w+)? (?:(?:THE|A|AN|EXISTING|OLD|NEW|FLAT|METAL|SHINGLE|TIN|CORRUGATED|GABLE|PITCHED|HIP|SHED|ASPHALT|SLOPED|REAR|SIDE|DAMAGED|LEAKING) ){0,3}(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S? (?:FLAT |METAL |SHINGLE |TIN |SHED |GABLE )?ROOF(?:ING|S)?\b(?! (?:ATTACHED |ADJACENT )?(?:OVER|ON|AT|FOR|TO|ABOVE|OFF) (?:THE |AN? |NEW |EXISTING |CONCRETE |REAR |FRONT |BACK |SIDE |DETACHED |COVERED |OPEN |SCREENED |SMALL |PROPOSED |WOOD |WOODEN )*(?:${PW_ACC}|PAVERS?|SLAB|DECK|DRIVEWAY|WALKWAY|POOL|HOT TUB|SPA|STAIRS?|STEPS|ENTRY|ENTRANCE|BOAT|BAR|BARN|WORKSHOP|STUDIO|GREENHOUSE)S?\b)`);
  const PW_PARTS = new RegExp(String.raw`^[^.;:,]{0,60}?(?<!\b(?:DEMO\w*|TEAR\w* DOWN|REMOV\w*|NO|CONSTRUCT\w*|BUILD\w*|ADD|ADDING|NEW|PROPOSED)\s(?:\w+ ){0,3})(?<!\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING)S? (?:ROOFS? )?(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT) )*)\b(?:ATTACHED SHED|LEAN.?TO(?: ADDITION)?|(?:REAR|SIDE) ADDITION)\b(?! (?:AND|&|PLUS|WITH) (?:[\w-]+ ){0,2}?(?:RENOVAT|REMODEL)\w*)(?! (?:AND|&|PLUS|TO) (?:AN? |THE )?(?:[\w-]+ ){0,3}?(?:HOUSE|HOME|RESIDENCE|DWELLING|SINGLE|DOUBLE|DUPLEX|STRUCTURE|BUILDING)\b)`);
  const PW_WHOLE = new RegExp(String.raw`\b(?:ENTIRE|WHOLE|FULL|COMPLETE)\b[^.;]{0,20}\bROOF|\bMAIN ROOF|\bROOF(?:ING|S)? (?:ON|OF|OVER|FOR) (?:THE )?(?:ENTIRE |WHOLE |MAIN |ORIGINAL |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\bRE[- ]?ROOF(?:ING|ED)? (?:OF )?(?:THE )?(?:ENTIRE |WHOLE |MAIN |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING|BUILDING)\b|\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN)S? (?:AND|&) (?:THE |REAR |SIDE )?(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S?\b|\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING)S? (?:ROOFS? )?(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT) )*(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S?\b(?=:? (?:(?:FLAT|METAL|SHINGLE|TIN|SHED|GABLE) )?(?:RE[- ]?ROOF|ROOF))|\b(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S? (?:AND|&) (?:THE )?(?:MAIN |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\b(?=ADDITION|LEAN|ATTACHED SHED|DORMER)(?<=\b(?:RE[- ]?ROOF|ROOF)\w*\b[^.;:]{0,40})(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S? (?:AND|&|PLUS) (?:(?:ON|OVER|TO|AT) )?(?:THE )?(?:(?:(?:MAIN|EXISTING|ORIGINAL|OLD|HISTORIC|FRONT|ENTIRE|WHOLE|ONE|TWO|1|2|STORY|SINGLE|FAMILY|[A-Z]+-(?:STORY|FAMILY)) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING)|(?:MAIN|ENTIRE|WHOLE|REST OF THE|REMAINDER OF THE) (?:ROOF|HOUSE))S?\b(?!['’])(?! (?:IS |ARE )?(?:TO|WILL|SHALL) (?:REMAIN|STAY)\b)`);
  const PW_ROOF1 = /\bRE[- ]?ROOF|\bROOF|\bRE[- ]?SHINGL|\bSHINGLE/;
  /* a roof word tied to part of the house: a roof (or its replacement, work, system or covering) on, over, at or of an addition, a
     dormer, a lean to or an attached shed, unless the text goes on to the house or the main roof, or such a part's own
     roof or reroof, unless the house comes first in the list ('house and addition roof replacement'), or the roof such a part is built
     with ('rear addition with new roof'), unless that roof goes on over the house or the house comes first in the list. A permit whose replacement
     wording is all on such roofs is a partial reroof unless the rest of the text names the whole roof or the house's roof. */
  const PW_PARTN = String.raw`(?:ADDITION(?!AL)|ADDITIONAL (?:AREA|SPACE|ROOM|SQUARE FOOTAGE)|LEAN.?TO|ATTACHED SHED|DORMER)S?`;
  const PW_HOUSEC = String.raw`(?:AND|&|PLUS) (?:(?:ON|OVER|TO|AT) )?(?:THE )?(?:(?:(?:MAIN|EXISTING|ORIGINAL|OLD|HISTORIC|FRONT|ENTIRE|WHOLE|ONE|TWO|1|2|STORY|SINGLE|FAMILY|[A-Z]+-(?:STORY|FAMILY)|DOUBLE) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING|DUPLEX|COTTAGE|(?:DOUBLE|SINGLE)(?=\s*(?:[.;,)]|$)))|(?:MAIN|ENTIRE|WHOLE|REST OF THE|REMAINDER OF THE) (?:ROOF|HOUSE))S?\b(?!['’])(?! (?:ROOFS? )?(?:(?:IS|ARE|WILL|SHALL|MUST|TO|DOES|DO|BE|BEING) )*(?:NOT|REMAIN|STAY|EXCLUDED)\w*\b)`;
  /* the house words right after the part, as round 8 read them (a house that starts a new clause there is a known miss) */
  const PW_HOUSE0 = String.raw`(?:AND|&|PLUS) (?:(?:ON|OVER|TO|AT) )?(?:THE )?(?:(?:(?:MAIN|EXISTING|ORIGINAL|OLD|HISTORIC|FRONT|ENTIRE|WHOLE|ONE|TWO|1|2|STORY|SINGLE|FAMILY|[A-Z]+-(?:STORY|FAMILY)) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING)|(?:MAIN|ENTIRE|WHOLE|REST OF THE|REMAINDER OF THE) (?:ROOF|HOUSE))S?\b(?!['’])(?! (?:ROOFS? )?(?:(?:IS|ARE|WILL|SHALL|MUST|TO|DOES|DO|BE|BEING) )*(?:NOT|REMAIN|STAY|EXCLUDED)\w*\b)`;
  /* a house named after a part ends its list item: more accessories or roof components, its roof, then the end of the clause, a comma,
     bracket, dash, colon, number or a preposition; anything else (a verb, other work) starts a new clause or names other work */
  const PW_HEND = String.raw`(?=(?:(?:,|,? (?:AND|&|PLUS)) (?:(?:THE|A|AN|ALL|BOTH|ITS|NEW|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*(?:${PW_ACCN}|PORCHES|GALLERIES|BALCONIES|GUTTERS?|DOWNSPOUTS?|FLASHINGS?|DRIP EDGES?|DECKING|SHEATHING|UNDERLAYMENT|FASCIAS?|SOFFITS?|VENTS?|SKYLIGHTS?)\b)*(?:(?: (?:ROOF(?:ING|S)?|SHINGLES|UNITS?)(?: (?:COVERING|SYSTEM)S?)?)(?:(?:,|,? (?:AND|&|PLUS)) (?:(?:THE|A|AN|ALL|BOTH|ITS|NEW|EXISTING|REAR|FRONT|BACK|SIDE|DETACHED|COVERED|SMALL) )*(?:${PW_ACCN}|PORCHES|GALLERIES|BALCONIES|GUTTERS?|DOWNSPOUTS?|FLASHINGS?|DRIP EDGES?|DECKING|SHEATHING|UNDERLAYMENT|FASCIAS?|SOFFITS?|VENTS?|SKYLIGHTS?)\b)*)?(?:\s*(?:[.;,()/+:]|$)|\s+[-–]| (?:\d|W/|(?:WHICH|THAT|WHO|WITH|PER|AS|USING|ACCORDING|DUE|DAMAGED|AFTER|DURING|FROM|BY|IN|ON|AT|OF|FOR|OVER|UNDER|THROUGHOUT|INCLUDING|EXCEPT|ONLY|BOTH|COMPLETE|COMPLETELY|ENTIRELY|FULLY|TOTALLY|APPROX\w*|ABOUT|TO (?:MATCH|(?:[A-Z]+ )?CODE)|MATCHING|MEETING|TOTAL\w*|WITHIN|FOLLOWING|BECAUSE|TOO|ALSO(?=\s*(?:[.;,)]|$)))\b)))`;
  const PW_TIE = new RegExp(String.raw`\b(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)?)(?=(?: (?:AND|&) (?:NEW |EXTERIOR )?(?:SIDING|WALLS?|WINDOWS?|TRIM|FASCIA|SOFFITS?|GUTTERS?|DOWNSPOUTS?|FRAMING|SHEATHING|DOORS?|DECKING|RAFTERS?|JOISTS?|CEILINGS?|FLOORS?|FLOORING|STRUCTURE|SHINGLES|INSULATION|PLYWOOD|DRYWALL|SHEETROCK|FLASHINGS?|WEATHER ?BOARDS?|WEATHERBOARDING|STUCCO|CLADDING|UNDERLAYMENT|FELT|SKYLIGHTS?|SHUTTERS?|VENTS?|EAVES|CORNICES?|RAILINGS?|COLUMNS?|PARAPETS?|BEAMS?|TRUSSES)(?= (?:ON|OVER|AT|OF|FOR|TO|ABOVE) (?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*(?!THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT |DORMER))| (?:SHINGLE |TILE |SLATE )?(?:REPLACEMENT|WORK|SYSTEM|COVERING|SHINGLES|MATERIALS?)|(?: DAMAGED (?:BY|IN|DURING|FROM|AFTER) [^.;,~]{0,30}?,?)? (?:(?:ALSO |STILL )?(?:WILL|SHALL|MUST|IS|ARE) (?:ALSO )?BE(?:ING)?|(?:HAS|HAVE|NEEDS?|IS|ARE) TO BE|TO BE|BEING) (?:(?:COMPLETELY|ENTIRELY|FULLY|TOTALLY) )?(?:(?:REMOVED|TORN OFF|STRIPPED) (?:AND|&) )?REPLACED)? (?:ON|OVER|AT|OF|FOR|TO|ABOVE) (?:THE |AN? |EXISTING |REAR |SIDE |BACK |FRONT |NEW |OLD |ONE |1 |TWO |2 |STORY |FLAT )*${PW_PARTN}\b(?! OF\b)(?! ${PW_HOUSE0})(?!,? (?:ADDITIONS?,? )?${PW_HOUSEC}${PW_HEND}))|(?<=\b${PW_PARTN} (?:(?:FLAT|METAL|SHINGLE|TIN|SHED|GABLE) )?)(?<!\b(?:(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING|DOUBLE|SINGLE|DUPLEX|COTTAGE|FAMILY)S? (?:ROOFS? )?|(?:FRONT|UPPER|ORIGINAL|EXISTING|OLD) (?:(?:SLATE|SHINGLE|TILE|METAL) )?ROOFS? )(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT) )*${PW_PARTN} (?:(?:FLAT|METAL|SHINGLE|TIN|SHED|GABLE) )?)(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)?)\b|(?<=\b${PW_PARTN} WITH (?:(?:A|AN|ITS OWN|ITS|NEW|METAL|SHINGLE|SHINGLED|FLAT|TIN|GABLE|HIP|SHED|PITCHED|ASPHALT|ARCHITECTURAL|STANDING SEAM) ){0,4})(?<!\b(?:HOUSE|HOME|RESIDENCE|DWELLING|MAIN|STRUCTURE|BUILDING|DOUBLE|SINGLE(?!(?<=(?:^|[.;:] ?|\b(?:CONSTRUCT\w*|BUILD\w*|ADD\w*|ERECT\w*|NEW|PROPOSED)(?: OF)?(?: AN?)?(?: NEW)? )SINGLE)(?: AND| &|,) (?:TWO|2|THREE|3|DOUBLE)[- ]STOR(?:Y|IES)\b)|DUPLEX|COTTAGE|FAMILY)S? (?:ROOFS? )?(?:AND|&|PLUS) (?:THE )?(?:(?:REAR|SIDE|BACK|FRONT|NEW|EXISTING|ORIGINAL|OLD|ONE|1|TWO|2|STORY|FLAT|SECOND|2ND|[A-Z0-9]+-STORY) )*${PW_PARTN} WITH (?:(?:A|AN|ITS OWN|ITS|NEW|METAL|SHINGLE|SHINGLED|FLAT|TIN|GABLE|HIP|SHED|PITCHED|ASPHALT|ARCHITECTURAL|STANDING SEAM) ){0,4})(?:RE[- ]?ROOF(?:ING|ED)?|ROOF(?:ING|S)?)\b(?! (?:ON|OVER|AT|OF|FOR|TO|ABOVE|COVERING|ACROSS|(?:EXTENDING|EXTENDED|CONTINUING|CONTINUED) (?:OVER|ACROSS|ONTO|TO)) (?:THE |AN? )?(?:(?:ENTIRE|WHOLE|MAIN|EXISTING|ORIGINAL|OLD|PRIMARY) )*(?:HOUSE|HOME|RESIDENCE|DWELLING|STRUCTURE|BUILDING)\b)`, 'g');
  const PW_WHOLER = new RegExp(String.raw`\b(?:ENTIRE|WHOLE|FULL|COMPLETE)\b[^.;]{0,20}\bROOF|\bMAIN ROOF|\bROOF(?:ING|S)? (?:ON|OF|OVER|FOR) (?:THE )?(?:ENTIRE |WHOLE |MAIN |ORIGINAL |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING)\b|\bRE[- ]?ROOF(?:ING|ED)? (?:OF )?(?:THE )?(?:ENTIRE |WHOLE |MAIN |EXISTING )?(?:HOUSE|HOME|RESIDENCE|DWELLING|BUILDING)\b|(?<!(?<!(?:\bAND|&|\bPLUS) (?:THE |A )?(?:DETACHED |REAR |FRONT |BACK |SIDE )?)\b${PW_ACCN} (?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)(?<!\b(?:NO|NONE OF|NO (?:PART|PORTION|SECTION) OF|NOTHING (?:ON|OF)) (?:(?:EXISTING|THE|MAIN) )?(?:(?:FLAT|METAL|SHINGLE|SLATE|TIN|TILE) )?)\bROOF(?:ING|S)?\b(?![- ]?(?:DECK|SHEATH|FRAM|STRUCT|JOIST|RAFTER|TRUSS|VENT|FLASH|GUTTER|DRAIN|JACK|PENETRAT|EDGE|CAP|HATCH|CURB|INSUL|COAT|LINE|SURFACE|REPAIR|LEAK|PATCH|DAMAGE(?!D (?:BY|IN|DURING|FROM|AFTER) [^.;,~]{0,30}?,? (?:TO BE|WILL BE|SHALL BE|IS BEING|ARE BEING|BEING) )))(?:(?! (?:NOT|NEVER|MAY|MIGHT|COULD|BE|${PW_ACC}|${PW_PARTN}|PORTION|SECTION|PART|AREA)S?\b)[^.;~]){0,30}\b(?:TO BE|WILL BE|SHALL BE|IS BEING|ARE BEING|BEING) (?:(?:COMPLETELY|ENTIRELY|FULLY|TOTALLY) )?(?:(?:REMOVED|TORN OFF|STRIPPED) (?:AND|&) )?(?:REPLACED|RE-?ROOFED)\b(?!,? \(?(?:AS (?:NEEDED|NECESSARY|REQUIRED(?! BY))|WHERE|IF|(?:ONLY )?WHEN (?:NEEDED|NECESSARY|REQUIRED)|ONLY (?:WHERE|IF|AS (?:NEEDED|NECESSARY|REQUIRED(?! BY)))\b|IN (?:THE )?(?:(?:DAMAGED|AFFECTED|DETERIORATED|ROTTED|ROTTEN|LEAKING|SOME|VARIOUS|SEVERAL|CERTAIN|BAD|WORN) )?(?:AREAS?|PLACES?|SECTIONS?|SPOTS?|LOCATIONS?)\b|IN[- ]KIND WHERE|AT (?:THE )?(?:DAMAGED|AFFECTED|LEAK)|AT A LATER DATE|IN THE FUTURE))`);
  function partOnly(d, R, F) { if (PW_WHOLE.test(d)) return false; const m = PW_PARTT.exec(d); return (!!m && m.index <= d.search(PW_ROOF1)) || ((R || F) && PW_PARTS.test(d)); }
  function permitW(p) {
    if (p.kind === 'newc') return 1;
    if (p.kind === 'mh') return 0.5;
    if (p.kind === 'rebuild') return p.w || 0;
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
  function statusOf(b) { const ck = CK[b.id]; b.status = ck && ck.s ? ck.s : b.sc.score >= CFG.green ? 'g' : b.sc.score >= CFG.orange ? 'o' : 'r'; b.checked = !!ck; return b.status; }
  /* the need as the card and the table say it: a building in red that nobody has checked is told as upkeep, not as a job */
  const needLabel = b => b.need.k !== 'none' && b.status === 'r' && !(CK[b.id] && CK[b.id].s) ? 'Not likely now: inspections and upkeep' : b.need.l;
  const STL = { g: 'Likely needs roof work', o: 'Maybe', r: 'Not likely' }, STS = { g: 'Likely', o: 'Maybe', r: 'Not likely' };

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
    const where = b2 => { const o = bs.filter(b => b.parcel && digits(b.parcel.apn) === b2).sort((x, y) => y.sqft - x.sqft)[0]; return o ? [o.lat, o.lon] : [(bx.s + bx.n) / 2, (bx.w + bx.e) / 2]; };
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
  /* A permit joins the main building at its address. When several main buildings share the address it joins the one its
     point falls in, else each of them at a share of its weight (a quarter, plus three quarters split among them: a
     permit there may cover one building or all of them), or in full when its text names all the buildings or roofs or
     the entire property. Only the buildings in the permit's own tile count, since buildings and permits load tile by
     tile. A detached garage or shed takes it only when no main building has the address. Without an address match it joins the main building nearest its point within 20 m of the walls,
     and names that building when it has no address yet (FEMA's California footprints carry none). A permit with a parcel
     number and no address match joins the buildings on that parcel (Sacramento and San Jose give no map point at all). A new construction or
     manufactured home permit is mostly for a building FEMA's footprints (2010 to 2012 lidar in the metros) do not have
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
  const accOnly = u => { const v = u.replace(ACC_PLACE, ' '); return ACC_ONLY.test(v.replace(ACC_WITH, ' ')) && !MAIN_BLDG.test(v); };
  /* a permit whose text names every building or roof at the address, or the entire property, covers each of them in full */
  const PW_ALL = /\b(?:ALL|EVERY|EACH)(?: OF)?(?: THE)? (?!OTHER\b)(?:[A-Z0-9'’&-]+ ){0,4}?(?:BUILDINGS|BLDGS)\b|\b(?:REPLAC\w*|RE-?ROOF\w*)(?: OF)? (?:ALL|EVERY|EACH)(?: OF)?(?: THE)? (?:[A-Z0-9'’&-]+ ){0,4}?ROOFS\b|\bENTIRE (?:COMPLEX|PROPERTY)\b/;
  function joinPermits(t, res) {
    const bs = [...t.ids].map(id => B.get(id)).filter(Boolean), byKey = new Map(), byApn = new Map();
    bs.forEach(b => { const a = b.parcel && b.parcel.apn ? digits(b.parcel.apn) : ''; if (a.length >= 6) { const g = byApn.get(a) || []; g.push(b); byApn.set(a, g); } });
    const index = b => { if (!b.akey) return; const g = byKey.get(b.akey) || []; if (!g.includes(b)) g.push(b); byKey.set(b.akey, g); };
    bs.forEach(index);
    const sigOf = p => p.d + '|' + p.desc.slice(0, 60), give = (b, p) => { const s = sigOf(p); if (b.permits.some(q => sigOf(q) === s)) return false; b.permits.push(p); b.permits.sort((x, y) => y.y - x.y); return true; };
    const isNew = p => p.kind === 'newc' || p.kind === 'mh';
    res.list.slice().sort((a, c) => isNew(a) - isNew(c)).forEach(p => {
      const nw = isNew(p); let at = (p.key && byKey.get(p.key)) || []; if (!at.length && p.apn) at = byApn.get(p.apn) || []; if (!at.length && p.byApn) return; const main = at.filter(b => b.cls !== 'garage' && b.cls !== 'shed');
      let targets = (main.length ? main : at).filter(b => !nw || b.addrVia !== 'near' || edgeMeters(p.lat, p.lon, b) <= 2);
      if (targets.length > 1) { const inside = targets.filter(b => edgeMeters(p.lat, p.lon, b) === 0); targets = inside.length ? inside : nw ? [] : targets; }
      if (targets.length) { p.via = 'addr'; p.share = targets.length > 1 && !PW_ALL.test(String(p.desc || '').toUpperCase()) ? 0.25 + 0.75 / targets.length : 1; targets.forEach(b => give(b, p)); return; }
      let best = null, bd = 1e9;
      bs.forEach(b => { if (b.cls === 'shed' || (nw && b.akey && b.akey !== p.key && b.addrVia !== 'near')) return; const d = edgeMeters(p.lat, p.lon, b) + (b.cls === 'garage' ? 6 : 0); if (d < bd) { bd = d; best = b; } });
      if (!best || bd > (nw ? 2 : 20) || p.byApn) return;
      p.via = bd <= 2 ? 'in' : 'near';
      if (!give(best, p)) return;
      /* a building FEMA gave no address takes the permit's; its own new construction permit, inside its walls, names it over an address a permit 2 to 20 m away only guessed */
      if (p.addr && (!best.addr || (nw && p.via === 'in' && best.addrVia === 'near' && p.key !== best.akey))) { if (best.akey && byKey.has(best.akey)) byKey.set(best.akey, byKey.get(best.akey).filter(x => x !== best)); best.addr = String(p.addr).split(',')[0].trim(); best.addrSrc = 'permit'; best.addrVia = p.via; const a = addrParts(p.addr); best.akey = a.key; best.street = a.street; index(best); }
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

  /* ---------- the next fifteen years: what each kind of roof is likely to suffer where it stands ---------- */
  /* An outlook built from California's own record, year by year for fifteen years, for one kind of roof at one ZIP whose
     age today is known as a spread of chances (the clock above). Each year a roof in place can:
       wear out          its Weibull life (module 17: one life for every covering but tile, refitted to the American
                         Housing Survey's West region; for tile the life of the underlayment), shortened or stretched
                         by the heat it takes where it stands (the Thermal reading below) against the average
                         California roof of its kind;
       take the wind     the days a year with a gust of 58 mph and of 75 mph at the ZIP's nearest screened station
                         (Santa Ana, Diablo and sundowner days and winter storm days alike), at the atlas's stated
                         rates of roofs damaged on such a day, turned for each covering and its age;
       leak in the rain  the repair line's calls a year, shaped by the roof's age (the shape is a judgment), leaned by
                         how much heavy rain the ZIP takes against the state: its days with an inch of rain and its
                         atmospheric river days of rank 3 and up, and a little more in snow country (ice dams);
       burn              the pace at which CAL FIRE's damage inspections record structures destroyed or damaged in
                         the ZIP and those within 40 km, 2013 to 2025, turned by the Fire Hazard Severity Zone the
                         building stands in and, slightly, by the covering;
       take hail         the days a year with 1 inch and 1.75 inch hail within 25 miles where the data counts them
                         (rare: 349 reports of an inch or more in California since 1951), at the atlas's stated rates;
     and two slower things are told beside them: moss and algae where it is wet, and rust on metal near salt water. A
     roof that is replaced starts again at age zero and stays in the count. What comes out is a chance, for the
     building's kind of roof at its ZIP, of each kind of damage by each year: the odds if the next fifteen years bring
     weather and fire at the pace of the record, not a forecast of a storm or a fire. Every rate that is a judgment is
     marked in OC. */
  const OUT_Y = 15;
  const AW = (ANCH.wind && ANCH.wind.length >= 2 ? ANCH.wind : null);
  const OC = {
    /* gust days: roofs damaged on a day with a 58 mph gust and on a day with a 75 mph gust (the atlas's stated rates
       where the data carries them, else 3 and 15 roofs in 10,000: a judgment, grade D; forecasters' reports in
       California first name roof damage at gusts of about 60 to 70 mph), and the share of that damage that is a
       replacement, not a repair (judgment). A station on a ridge or in a pass can count far more days than the
       streets below it take: days are capped at 25 and 5 a year. */
    wind: [[+(AW && AW[0]) || 0.0003, 0.2], [+(AW && AW[1]) || 0.0015, 0.4]], capG58: 25, capG75: 5,
    /* hail: roofs damaged per day with 1 inch hail, and a further share per day with 1.75 inch hail (stated rates), with the share replaced (judgment) */
    hail: [[0.0022, 0.6], [0.004, 0.9]],
    /* A roof's age against the wind, as a multiple of the hazard (before scaling: the average California roof is 1).
       Shingles hold for their first years and then let go: the University of Florida found no unsealed shingles on roofs
       under four years old, under 1 percent of strips at six years, 12 percent at 7 to 13 and 30 percent at 14 to 20,
       with hip and ridge caps unsealed at every age (Dixon and others 2013); in a survey of 623 homes after a 2020
       coastal windstorm, 40 percent of two to three year old shingle roofs were damaged against 97 percent of those 14 to 15
       years old, with a break near eight years (NIST 2026); in the 2020 Midwest derecho a roof over ten years old was
       five times as likely to show damage as one of three to six (IBHS 2023). None of these is a California study:
       none was found. The multiple below is drawn through them (judgment, grade D) and scaled so that California's
       roofs at their ages today (module 17) average 1. */
    age: a => (a <= 3 ? 0.08 : a <= 6 ? 0.08 + (a - 3) * 0.26 / 3 : a <= 9 ? 0.34 + (a - 6) * 0.22 : a <= 15 ? 1 + (a - 9) * 0.4 / 6 : a <= 20 ? 1.4 + (a - 15) * 0.04 : 1.6),
    /* Metal and tile age another way: in a Florida survey of 768 roofs damage on them rose negligibly until the roof was
       past ten (University of Florida and Auburn 2023). Their multiple stays low for ten years and rises after, as
       fasteners back out and underlayment and battens age (the rise is a judgment). Scaled the same way. */
    ageHard: a => (a <= 10 ? 0.4 : a <= 25 ? 0.4 + (a - 10) * 0.1 : 1.9),
    /* and against hail: weathered shingles and membranes grow brittle (RICOWI's Dallas survey rated shingles over 9 years
       old at twice the damage of newer ones; Haag); tile and steel do not change with age */
    hailAge: a => (a <= 5 ? 0.6 : a < 9 ? 0.6 + (a - 5) * 0.1 : a < 15 ? 1 + (a - 9) * 0.5 / 6 : 1.5),
    /* wind at the roof: taller buildings stand in faster air (ASCE 7 exposure coefficients, judgment on the step) */
    tall: st => (st >= 3 ? 1.2 : st === 2 ? 1.1 : 1),
    /* the fire record: the years CAL FIRE's digital damage inspections cover; each ZIP's own record is steadied by the
       ZIPs within 40 km, by their homes, because where a fire ran is partly luck; a damaged structure counts half */
    fireFrom: 2013, fireTo: 2025, nearKm: 40, own: 0.6, dmgW: 0.5,
    /* rain's lean on leaks: the square root of the ZIP's heavy rain against the state's, held between 0.6 and 1.6 (a roof
       leaks when it rains, but repair calls do not double where rain does: judgment, grade D); snow country adds up to 30 percent */
    rainLo: 0.6, rainHi: 1.6, snowLeak: 0.3,
  };
  /* the kinds of roof the outlook tells apart. life: the clock's key (LIFE); wind: against shingles; ageK: how much of
     the shingles' ageing against wind the covering shares, or 'hard' for metal and tile, which follow OC.ageHard (their
     wind factors are a judgment from the Florida survey above, about a fifth to a third of the shingles' hazard past
     five years; nothing was found on wood shakes, which are taken a little worse than shingles); hail: against shingles
     on a 1 inch day and on a 1.75 inch day, from Haag Engineering's threshold sizes; hailK: how much of the shingles'
     ageing against hail it shares; leak: repair calls against the survey's rate (judgment); fire: the relative risk of
     destruction in the 2013 to 2018 fires by roof material (Syphard and Keeley 2019, statewide: asphalt 1.05, tile
     0.88, concrete 0.89, metal 0.97, wood 1.00 and not significant: roof material "did not explain substantial
     variation", because most roofs were already fire resistant and embers got in at eaves, vents and windows); cls:
     the fire class the covering most likely carries as an assembly [A, B, C, unrated] when new or re-roofed since the
     class rules, and old (see the Fire view); what each cause does to it. */
  const RTYPE = {
    shingle: { l: 'Asphalt shingles', s: 'shingles', life: 'shingle', wind: 1, ageK: 1, hail: [1, 1], hailK: 1, leak: 1, algae: 1, rust: 0, fire: 1.05,
      does: { wind: 'Hip and ridge caps go first; tabs lift, crease and blow off, in the middle of a slope about as often as along its edges; limbs come through the deck', rain: 'Leaks at pipe boots, wall and chimney flashing, valleys and nail pops; a long atmospheric river finds every one of them', fire: 'Most asphalt shingle roofs are Class A assemblies and do not ignite from embers alone; fires get in at open eaves, vents wider than 1/8 inch, gutters full of needles and the gap at the roof edge', hail: 'Bruises that crack the mat under the granules, granule loss in spatters; dents in vents and flashing mark the size', wear: 'Granules wash off, the asphalt dries and cracks, tabs curl and blister; the south and west slopes go first, and faster in the valleys and deserts', algae: 'Dark algae streaks and moss, first on the north and shaded slopes', rust: '' } },
    tile: { l: 'Tile (clay or concrete), or slate', s: 'tile', life: 'tile', wind: 0.3, ageK: 'hard', hail: [0.1, 0.85], hailK: 0, leak: 1.1, algae: 0.5, rust: 0, fire: 0.88,
      does: { wind: 'Tiles lift, slide and break at the eaves, hips and ridge; loose pieces break more; mortar set ridge and hip tiles fail first', rain: 'Water gets under tile by design; the underlayment sheds it. Leaks come where the underlayment has worn through, at valleys, flashings and slipped pieces, and show in the first long storm of a wet winter', fire: 'Clay and concrete tile do not burn, but the air space under them lets embers reach the underlayment and deck: in a fire zone the code wants bird stops at the eaves, mudded hips and ridges and a 72 pound cap sheet or a Class A underlayment under the tile', hail: 'Cracked and broken tiles from hail of 1.5 to 1.75 inches and up; corners and exposed edges go first', wear: 'The tile outlasts the underlayment and the fasteners under it: about 25 years for standard underlayment by the trade\'s figures, then slipped pieces, rusted nails and felt that no longer sheds water. The job is a lift and relay: new underlayment under the same tile', algae: 'Moss, lichen and mildew on shaded slopes', rust: '' } },
    wood: { l: 'Wood shakes or shingles', s: 'wood shakes', life: 'wood', wind: 1.1, ageK: 1, hail: [0.9, 1], hailK: 1, leak: 1.2, algae: 1.3, rust: 0, fire: 1,
      does: { wind: 'Split and loosened shakes lift and blow off; ridge caps go first', rain: 'Cupped, split and missing shakes let water to the interlayment; moss holds water against the wood', fire: 'An untreated wood roof is the one covering the older fires single out: in the 1990 Painted Cave fire 70 percent of homes with nonflammable roofs survived against 19 percent with flammable ones. No untreated wood roofing may be sold or applied in California, and Los Angeles and San Diego allow no wood re-roof', hail: 'Splits along the grain from the larger stones', wear: 'Shakes split, cup and curl in the sun and rot where they stay wet; the interlayment felt ages with them', algae: 'Moss and lichen, heavy where it is wet and shaded', rust: '' } },
    flat: { l: 'Low slope roof on a house', s: 'low slope roofs', life: 'flat', wind: 0.6, ageK: 0.6, hail: [0.15, 0.6], hailK: 0.8, leak: 1.5, algae: 0.3, rust: 0, fire: 1,
      does: { wind: 'A cap sheet or membrane peels from the edge once the edge metal or a flashing lets go; gravel scours', rain: 'Ponding at clogged scuppers and drains, open laps and blisters, flashings pulled from parapets and skylights: a flat roof shows its age in the first atmospheric river of the season', fire: 'A cap sheet or a gravel surfaced built up roof is usually a Class A assembly; embers collect in leaf litter at parapets and scuppers', hail: 'Fractured or punctured membrane, sooner when weathered', wear: 'The sun dries the asphalt and takes the granules; seams open, the sheet shrinks and blisters; ponding speeds all of it', algae: 'Dirt and growth where water stands', rust: '' } },
    metal: { l: 'Metal (standing seam or panels)', s: 'metal', life: 'metal', wind: 0.3, ageK: 'hard', hail: [0.03, 0.15], hailK: 0, leak: 0.7, algae: 0.15, rust: 1, fire: 0.97,
      does: { wind: 'Panels peel at the eaves, rakes and ridge where clips or screws let go; ridge caps and trim strip', rain: 'Leaks at screws, laps, ridge and pipe boots', fire: 'Metal does not burn; the deck under it can, where debris packs the ribs at the eave or the edge is open', hail: 'Dents that leave the coating whole; it takes hail of about 2.5 inches to split a panel', wear: 'On exposed fastener roofs screws back out and their washers dry and split; paint chalks and fades; sealant at laps fails', algae: 'Dirt and mildew film on shaded panels', rust: 'Red rust at cut edges, laps, scratches and fasteners; salt air off the Pacific and the bays speeds it, and makers do not warrant the coating close to salt water' } },
    mh: { l: 'Manufactured home roof', s: 'manufactured home roofs', life: 'mh', wind: 1.3, ageK: 1, hail: [0.8, 0.9], hailK: 0.6, leak: 1.3, algae: 0.6, rust: 0.6, fire: 1.05,
      does: { wind: 'Metal roof sheets peel from the edges and a roof over lifts; on pitched double wides shingles strip as on a house, sooner, because the decks are lighter', rain: 'Leaks at seams, vents and the marriage line', fire: 'Light roofs over light walls: in the fires of 2017 to 2020 whole parks were lost', hail: 'Dented sheet metal, cracked coatings', wear: 'Seams and fasteners open, coatings chalk and crack, the roof over sags and ponds', algae: 'Mildew and algae on coatings and shingles', rust: 'Rust at seams, fasteners and edges of sheet metal roofs' } },
    low: { l: 'Low slope membrane', s: 'low slope membranes', life: 'low', wind: 0.7, ageK: 0.6, hail: [0.15, 0.6], hailK: 0.8, leak: 1.4, algae: 0.3, rust: 0, fire: 1,
      does: { wind: 'The membrane peels from the corners and edges once the edge metal or a flashing lets go; gravel scours; rooftop units shift and tear their curbs', rain: 'Leaks at seams, drains, curbs and wall flashings; ponding where drains clog; wet insulation under the membrane', fire: 'Most membranes and cap sheets are Class A assemblies; embers gather at parapets, rooftop units and skylights', hail: 'Fractured or punctured membrane, crushed insulation under it, split base flashing', wear: 'Seams open, flashings pull from walls and curbs, the membrane shrinks, cracks and blisters; a white membrane soils and loses reflectance (the Energy Code counts on about 70 percent of its gain over 0.20 lasting three years)', algae: 'Dirt and growth that darken a white membrane and raise its temperature', rust: '' } },
    mbldg: { l: 'Metal building roof', s: 'metal building roofs', life: 'mbldg', wind: 0.7, ageK: 'hard', hail: [0.03, 0.15], hailK: 0, leak: 1.2, algae: 0.1, rust: 1, fire: 0.97,
      does: { wind: 'Panels peel from the eave and rake, ridge caps and gutters strip, skylight panels shatter', rain: 'Leaks at fasteners, laps, ridge, skylight panels and around units', fire: 'Steel panels do not burn; plastic skylight panels and what is stored under the roof do', hail: 'Dents that leave the coating whole; fractured skylight panels', wear: 'Fasteners back out, washers and lap sealant fail, panels move at the laps', algae: 'Dirt film', rust: 'Rust at eaves, laps, around units and at every scratch; faster in salt air' } },
  };
  RTYPE.lowmf = Object.assign({}, RTYPE.low, { life: 'lowmf', wind: 0.8 });
  const CAUSES = [['wind', 'Wind'], ['rain', 'Rain and leaks'], ['fire', 'Wildfire'], ['hail', 'Hail'], ['wear', 'Heat, sun and age']];
  const CAUSE_L = Object.fromEntries(CAUSES);
  /* California's roofs by age today (module 17), as shares: what the wind and hail rates are an average over */
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
  const windAgeK = (a, k) => gFor(k).w[Math.min(a, AGE_MAX)], hailAgeK = (a, k) => gFor(k).h[Math.min(a, AGE_MAX)];
  /* Salt water, for salt air on metal: the Pacific shore from the atlas's own state outline (about 200 m to a step; the
     land borders with Oregon, Nevada, Arizona and Mexico are cut out by a line drawn inland of the coast), and the bay
     shores from a short list of points placed by hand along San Francisco, San Pablo and San Diego bays, Humboldt Bay,
     Morro Bay, Mission Bay, Newport Bay, Marina del Rey and the Los Angeles and Long Beach harbor (good to about a
     kilometre: the first salt step, half a kilometre, is approximate beside a bay). Suisun Bay and the Delta are
     brackish and are not counted (a judgment). */
  const COAST_EAST = [[32.4, -116.95], [33.0, -117.05], [33.5, -117.35], [34.0, -117.9], [34.5, -119.0], [35.0, -120.2], [36.0, -121.0], [37.0, -121.6], [38.0, -122.2], [39.0, -123.2], [40.0, -123.6], [41.0, -123.7], [42.1, -123.8]];
  const coastEast = la => { const C = COAST_EAST; if (la <= C[0][0]) return C[0][1]; for (let i = 1; i < C.length; i++) if (la <= C[i][0]) return C[i - 1][1] + (C[i][1] - C[i - 1][1]) * (la - C[i - 1][0]) / (C[i][0] - C[i - 1][0]); return C[C.length - 1][1]; };
  const BAYS = [[37.80, -122.39], [37.76, -122.38], [37.72, -122.36], [37.67, -122.38], [37.62, -122.37], [37.57, -122.25], [37.51, -122.21], [37.46, -122.10], [37.43, -121.97], [37.50, -122.03], [37.56, -122.09], [37.63, -122.15], [37.70, -122.19], [37.71, -122.22], [37.77, -122.28], [37.80, -122.32], [37.84, -122.30], [37.87, -122.31], [37.91, -122.36], [37.96, -122.40], [38.01, -122.36], [38.02, -122.28], [38.06, -122.22], [38.02, -122.13], [38.05, -122.15], [38.10, -122.26], [38.10, -122.50], [38.03, -122.50], [37.97, -122.49], [37.92, -122.48], [37.87, -122.45], [37.86, -122.48],
    [32.71, -117.23], [32.72, -117.18], [32.71, -117.17], [32.69, -117.15], [32.66, -117.11], [32.62, -117.10], [32.60, -117.11], [32.63, -117.14], [32.69, -117.17], [32.78, -117.23], [33.62, -117.89], [33.61, -117.91], [33.74, -118.25], [33.76, -118.20], [33.75, -118.22], [33.98, -118.45], [40.80, -124.17], [40.86, -124.09], [40.75, -124.21], [35.34, -120.85], [35.37, -120.86]];
  const SHORE = (() => { const pts = []; try { pathRings(G0.outline).forEach(r => r.forEach(([la, lo]) => { if (la < 41.99 && la > 32.535 && lo < coastEast(la)) pts.push([la, lo]); })); } catch (e) { /* no outline: the bays alone */ } return pts.concat(BAYS); })();
  const coastMemo = new Map();
  function coastKm(la, lo) {
    if (!isN(la) || !isN(lo) || !SHORE.length) return 999; const k = la.toFixed(4) + ',' + lo.toFixed(4); let v = coastMemo.get(k);   /* to about 10 m: the salt steps begin at half a kilometre */
    if (v === undefined) { let best = 1e18; const kx = Math.cos(rad(la)) * 111.32; for (const p of SHORE) { const dy = (p[0] - la) * 110.9, dx = (p[1] - lo) * kx, d = dx * dx + dy * dy; if (d < best) best = d; } v = Math.sqrt(best); if (coastMemo.size > 20000) coastMemo.clear(); coastMemo.set(k, v); }
    return v;
  }
  /* salt air on steel: the years of coating life left against inland (ISO 9223: zinc goes several times faster in the first
     kilometres from salt water; makers void 55 percent aluminium zinc and paint warranties within about 450 m of it). Judgment on the steps. */
  const SALT = [0.4, 0.55, 0.75, 0.9, 1], saltIx = km => (km < 0.5 ? 0 : km < 2 ? 1 : km < 8 ? 2 : km < 25 ? 3 : 4), saltK = km => SALT[saltIx(km)];
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
  /* the heat a roof of a kind takes at a place against the average California roof of that kind (by one unit roofs, over a sample of one ZIP in eight):
     the Thermal reading's yearly ageing rate, from the 1991 to 2020 normals. The outlook shortens or stretches the
     roof's life by the square root of it: heat is one of several things that age a roof (judgment). */
  const SHEAT = new Map();
  function stateHeat(type) { let v = SHEAT.get(type); if (v !== undefined) return v; let s = 0, n = 0; Z.forEach((z, i) => { const w = +z.roofs || 0; if (i % 8 || !(w > 0) || !isN(z.lat)) return; s += w * heatRef(type, z.lat, z.lon); n += w; }); v = n > 0 ? s / n : null; SHEAT.set(type, v); return v; }
  function climHeat(type, la, lo) { if (!isN(la) || !isN(lo)) return 1; const s = stateHeat(type); return s > 0 ? clamp(heatRef(type, la, lo) / s, 0.6, 1.6) : 1; }
  /* One kind of roof at one ZIP, fifteen years on, from a spread of chances over the roof's age today (d0). o.fk: the fire
     zone's turn on the ZIP's pace of fire losses (fireK); o.st: stories; o.heat: how hard the sun works this roof
     against the average California roof of its kind (1: the same; the place's normals and the Scout Engine's reading
     of the roof's planes supply it, held between 0.5 and 1.6): its life shortens or stretches by the square root of
     that, because heat is one of several things that age a roof (judgment).
     The building is followed, not the roof stock: every case is a spread of chances over the age of the roof then on the
     building, and a replacement by anything puts it back at age zero. Beside every case (dist) the count keeps the cases
     where today's roof is still on (own), those where no roofer has been called (clean) and, cause by cause, those the
     cause has not touched yet (nc), has not replaced yet (nr) and has not repaired yet (nf). Out come, for each year 0 to
     15: the chance by then of each cause at least once (C), of a replacement by it (R) and of a repair after it (F); of
     any replacement (rep, one minus keep), of any call for a roofer (any), of today's roof still being on (keep); the
     mean age of the roof then in place (age), and the slow marks on that roof (alg; rust for each step of salt air).
     The count is linear in d0, so a building's many possible clock starts are blended into one spread for each covering
     first (outlookOf) and counted once. */
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
  function count(type, zip, d0in, o) {
    o = o || {}; const rec = fkKey(o.fk), st = o.st || 1, heat = isN(o.heat) ? clamp(o.heat, 0.5, 1.6) : 1, Q = chances(type, zip, rec, st, heat), CK = Q.CK, NK = CK.length;
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
    o = o || {}; const rec = fkKey(o.fk), st = o.st || 1, heat = isN(o.heat) ? clamp(o.heat, 0.5, 1.6) : 1, T = RTYPE[type] || RTYPE.shingle, key = [type, zip, y0, rec, st, heat.toFixed(2), o.exact ? 'x' : ''].join('|');
    let f = FWD.get(key); if (f) return f;
    const d0 = o.exact ? (() => { const d = new Float64Array(clamp(THIS_YEAR - y0, 0, HMAX) + 2); d[clamp(THIS_YEAR - y0, 0, HMAX)] = 1; return d; })() : (rstate(T.life, zip, y0) || {}).dist;
    f = count(type, zip, d0, { fk: o.fk, st, heat }); if (FWD.size > 1500) FWD.clear(); FWD.set(key, f); return f;
  }
  /* several of those, weighted: a building's mix of coverings and of years its clock may have started in. si: the step of
     salt air the building stands in, for rust. */
  function blend(parts, si) {
    const Z0 = () => new Float64Array(OUT_Y + 1), o = { C: {}, R: {}, F: {}, rep: Z0(), any: Z0(), keep: Z0(), age: Z0(), alg: Z0(), rust: Z0() }; CAUSES.forEach(([c]) => { o.C[c] = Z0(); o.R[c] = Z0(); o.F[c] = Z0(); }); let W = 0; si = clamp(si == null ? SALT.length - 1 : si, 0, SALT.length - 1);
    parts.forEach(([f, w]) => { if (!f || !(w > 0)) return; W += w; for (let t = 0; t <= OUT_Y; t++) { CAUSES.forEach(([c]) => { o.C[c][t] += f.C[c][t] * w; o.R[c][t] += f.R[c][t] * w; o.F[c][t] += f.F[c][t] * w; }); o.rep[t] += f.rep[t] * w; o.any[t] += f.any[t] * w; o.keep[t] += f.keep[t] * w; o.age[t] += f.age[t] * w; o.alg[t] += f.alg[t] * w; o.rust[t] += f.rust[si][t] * w; } });
    if (W > 0) for (let t = 0; t <= OUT_Y; t++) { CAUSES.forEach(([c]) => { o.C[c][t] /= W; o.R[c][t] /= W; o.F[c][t] /= W; }); o.rep[t] /= W; o.any[t] /= W; o.keep[t] /= W; o.age[t] /= W; o.alg[t] /= W; o.rust[t] /= W; }
    o.W = W; return o;
  }
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
  /* one kind of roof of a given age at a ZIP, with no building under it: for the table by kind of roof */
  function outlookType(type, zip, ageYears, o) { return forward(type, zip, Math.round(THIS_YEAR - clamp(ageYears, 0, 60)), Object.assign({ exact: true }, o || {})); }

  /* ---------- heat: what the sun does to a roof ---------- */
  /* A roof plane's temperature from an energy balance at its surface: the sunlight it absorbs (its slope and bearing
     against the sun, the covering's solar reflectance) leaves as heat carried off by the air (a film coefficient that
     rises with wind) and as long wave radiation to a sky colder than the air (the covering's emittance). Clear sky
     sunlight is Meinel's fit to air mass with Kasten and Young's air mass; the air is the 1991 to 2020 normal for the
     month, blended from California's nearest stations by distance and by height (70 stations from the coast to the high
     Sierra and the deserts; 100 m of height counts as 10 km, and what height is left over is taken at 6.5 C a
     kilometre), shaped through the day. It is a steady balance: a light roof with a
     vented attic under it follows the sun within minutes. The film is set at 12 W per square metre and
     kelvin, the low end of the 12 to 20 Berdahl and others give for roofs (written below as McAdams's 5.7 + 3.8 v at 1.65
     m/s). It is a calibration, not a measured wind: the air a hand above Florida's test shingles moved at 0.4 m/s, a
     sixth of the mast's speed, and McAdams's film at that speed would put a dark shingle near 190 F. At 12 a dark shingle
     in July sun stands near 170 F over 90 F air, where the Florida Solar Energy Center (179 F at most in a summer), IBHS
     (about 165 F on a June day) and Oak Ridge (165 F) measured it, a white roof near 115 F (Oak Ridge: white painted
     metal, about 115 F) and bare aluminium zinc steel between. */
  const CLIM = [
    /* NOAA NCEI 1991 to 2020 normals, by-station files: daily maximum and minimum by month, degrees Fahrenheit; el: the station's elevation, metres */
    { n: 'Crescent City', lat: 41.7958, lon: -124.2147, el: 13, hi: [54.3,55.2,56.1,57.9,60.8,63.1,65.4,66.1,65.9,62.1,56.6,53.1], lo: [40.0,40.2,41.1,43.2,45.7,48.1,51.1,51.6,48.4,45.5,41.6,39.2] },
    { n: 'Eureka', lat: 40.8097, lon: -124.1603, el: 6, hi: [55.1,55.4,56.1,57.4,59.6,61.9,63.1,64.0,63.9,61.9,57.8,54.7], lo: [40.8,41.3,42.4,44.2,47.7,50.1,52.4,53.0,50.5,46.8,43.2,40.0] },
    { n: 'Ukiah', lat: 39.1467, lon: -123.2103, el: 194, hi: [56.9,60.2,64.8,69.6,76.3,82.8,91.1,90.6,87.0,76.7,62.8,55.6], lo: [37.4,38.3,39.7,42.4,47.3,51.9,55.6,54.2,51.3,45.5,40.0,36.2] },
    { n: 'San Francisco (downtown)', lat: 37.7706, lon: -122.4269, el: 46, hi: [57.8,60.4,62.1,63.0,64.1,66.5,66.3,67.9,70.2,69.8,63.7,57.9], lo: [46.6,47.9,48.9,49.7,51.4,53.0,54.4,55.5,55.6,54.4,50.7,47.0] },
    { n: 'San Francisco (airport)', lat: 37.6197, lon: -122.3647, el: 2, hi: [58.0,60.8,63.4,65.6,68.3,71.5,72.6,73.4,74.8,72.3,64.3,58.2], lo: [44.5,46.1,47.6,49.1,51.6,53.6,55.3,56.4,55.9,53.4,48.5,44.6] },
    { n: 'Oakland', lat: 37.7214, lon: -122.2208, el: 2, hi: [57.7,60.3,63.1,65.6,67.9,71.4,71.6,72.4,74.1,71.5,63.9,57.9], lo: [42.0,44.6,47.0,49.1,51.9,54.1,56.2,56.9,55.5,51.2,45.8,42.3] },
    { n: 'San Jose', lat: 37.3592, lon: -121.9239, el: 16, hi: [59.8,62.4,65.9,69.2,73.8,79.1,80.8,81.4,80.7,75.8,66.1,59.5], lo: [41.8,43.9,46.3,48.4,52.1,55.5,58.1,58.6,57.2,52.7,45.7,41.7] },
    { n: 'Santa Rosa', lat: 38.4558, lon: -122.7133, el: 51, hi: [59.7,63.6,66.9,70.6,74.5,80.2,81.6,83.0,83.9,78.9,67.1,59.0], lo: [38.4,40.0,41.9,43.9,47.8,51.1,52.1,52.5,51.0,47.6,42.0,38.2] },
    { n: 'Livermore', lat: 37.6928, lon: -121.8144, el: 120, hi: [57.4,61.0,65.1,69.3,75.3,82.6,87.7,87.5,85.4,77.9,65.6,57.8], lo: [37.8,39.9,41.8,44.6,49.4,53.5,56.6,56.7,54.9,49.2,41.9,37.5] },
    { n: 'Santa Cruz', lat: 36.9878, lon: -121.9994, el: 21, hi: [62.5,63.9,66.5,69.3,71.4,74.0,74.3,75.8,76.7,73.9,66.7,61.5], lo: [41.4,42.7,44.1,45.7,49.0,51.6,54.3,54.6,52.9,49.5,44.4,40.9] },
    { n: 'Monterey', lat: 36.5881, lon: -121.8453, el: 50, hi: [61.6,62.1,62.5,63.3,65.4,67.9,68.9,70.0,70.9,69.8,65.2,61.6], lo: [43.3,45.2,45.9,47.4,49.9,52.2,54.2,55.0,53.8,50.8,45.8,42.7] },
    { n: 'Salinas', lat: 36.6636, lon: -121.6081, el: 23, hi: [62.3,63.3,65.5,67.1,68.3,70.3,70.7,72.4,74.4,73.7,67.7,61.6], lo: [41.6,42.9,44.5,46.4,50.3,52.9,55.0,55.5,54.0,49.6,44.4,40.6] },
    { n: 'Paso Robles', lat: 35.6697, lon: -120.6283, el: 247, hi: [61.0,63.0,67.5,73.5,81.0,88.5,93.2,94.0,90.1,80.6,68.6,60.3], lo: [35.1,37.2,39.5,40.8,45.7,49.8,53.6,53.2,49.9,43.6,37.1,33.4] },
    { n: 'San Luis Obispo', lat: 35.3056, lon: -120.6619, el: 94, hi: [64.9,65.2,67.3,69.3,71.9,75.7,78.3,79.7,80.1,77.8,70.8,64.4], lo: [44.0,44.4,46.1,46.8,49.3,51.8,54.2,54.8,53.8,51.5,47.4,43.7] },
    { n: 'Santa Barbara', lat: 34.4258, lon: -119.8425, el: 3, hi: [64.2,63.8,65.9,67.8,69.2,70.3,73.3,74.5,74.3,73.4,69.2,64.3], lo: [41.3,43.6,46.2,48.1,51.3,54.5,58.1,58.0,55.7,50.9,44.3,40.4] },
    { n: 'Los Angeles (airport)', lat: 33.9381, lon: -118.3889, el: 30, hi: [66.3,65.6,66.1,68.1,69.5,72.0,75.1,76.7,76.5,74.4,70.9,66.1], lo: [49.4,50.1,52.2,54.2,57.6,60.9,64.0,64.8,63.7,59.8,53.7,49.1] },
    { n: 'Los Angeles (downtown)', lat: 34.0511, lon: -118.2353, el: 70, hi: [68.0,68.0,69.9,72.4,73.7,77.2,82.0,84.0,83.0,78.6,72.9,67.4], lo: [48.9,50.0,52.4,54.8,58.1,61.4,64.7,65.4,64.2,59.9,53.1,48.2] },
    { n: 'Long Beach', lat: 33.8117, lon: -118.1464, el: 9, hi: [67.4,66.8,68.6,71.4,73.1,76.1,81.4,83.2,82.4,77.7,72.5,66.7], lo: [46.9,48.4,51.2,53.9,57.9,61.3,64.9,65.5,63.9,59.1,51.6,46.6] },
    { n: 'Burbank', lat: 34.2006, lon: -118.3575, el: 226, hi: [67.0,66.8,69.5,72.7,75.5,80.3,86.7,88.9,86.6,79.4,72.5,66.1], lo: [45.3,46.4,49.0,51.9,56.6,59.9,64.5,64.9,62.9,57.5,49.0,44.2] },
    { n: 'Pasadena', lat: 34.1483, lon: -118.1447, el: 263, hi: [68.1,69.3,72.6,76.2,78.3,83.7,89.1,91.3,89.9,83.0,74.7,67.2], lo: [45.5,46.1,48.4,50.6,53.9,57.8,62.0,63.2,61.6,56.3,49.6,44.7] },
    { n: 'Woodland Hills', lat: 34.1819, lon: -118.5744, el: 241, hi: [69.8,70.0,74.0,78.0,82.0,88.5,95.1,97.4,93.9,85.2,76.4,68.9], lo: [43.1,43.6,45.9,48.1,52.6,56.9,60.8,60.8,58.5,52.9,46.0,42.0] },
    { n: 'Santa Ana', lat: 33.6800, lon: -117.8664, el: 16, hi: [67.0,66.7,67.7,70.2,71.3,74.1,78.9,80.4,79.9,76.5,71.9,66.5], lo: [48.6,50.1,52.3,54.9,59.3,62.6,66.2,67.1,65.0,59.2,53.3,48.3] },
    { n: 'Oxnard', lat: 34.2008, lon: -119.2069, el: 11, hi: [65.9,65.4,65.6,66.6,68.0,69.5,72.9,73.5,73.5,73.5,70.0,65.9], lo: [46.1,47.7,49.3,50.5,54.3,57.9,60.6,60.6,59.7,55.4,50.1,46.9] },
    { n: 'San Diego', lat: 32.7336, lon: -117.1831, el: 5, hi: [66.4,66.2,67.0,68.8,69.5,71.7,75.3,77.3,77.2,74.6,70.7,66.0], lo: [50.3,51.8,54.5,57.1,60.0,62.6,66.1,67.5,66.2,61.5,54.8,49.8] },
    { n: 'El Cajon', lat: 32.8006, lon: -116.9281, el: 151, hi: [69.3,69.2,71.3,74.5,76.2,80.8,86.1,88.6,87.3,81.0,75.2,68.5], lo: [42.5,44.4,48.0,50.7,55.9,59.4,63.3,64.7,62.1,55.6,47.1,41.7] },
    { n: 'Escondido', lat: 33.1211, lon: -117.0900, el: 183, hi: [68.8,68.7,71.0,74.2,76.7,81.9,87.2,89.0,86.9,80.8,74.6,68.0], lo: [44.8,45.9,48.9,51.8,56.4,60.2,64.4,65.3,63.1,57.3,49.1,43.8] },
    { n: 'Campo', lat: 32.6261, lon: -116.4681, el: 805, hi: [61.5,61.4,65.0,69.3,75.8,85.1,91.4,92.9,87.7,77.9,68.6,60.9], lo: [34.8,34.9,35.3,37.6,42.0,45.7,53.5,54.9,50.5,43.0,37.5,33.6] },
    { n: 'Riverside', lat: 33.9519, lon: -117.4386, el: 245, hi: [67.7,67.9,72.1,75.9,79.9,86.7,93.3,94.9,91.3,82.7,74.5,66.8], lo: [43.6,44.7,46.9,50.0,55.3,59.3,63.9,64.7,61.9,55.2,47.4,42.8] },
    { n: 'Ontario', lat: 34.0561, lon: -117.6003, el: 289, hi: [67.7,68.1,71.7,75.7,79.8,86.4,93.8,94.9,91.3,82.6,74.7,66.9], lo: [44.6,46.2,48.7,51.1,55.6,60.0,64.7,65.2,63.8,57.1,49.0,43.6] },
    { n: 'Redlands', lat: 34.0369, lon: -117.1947, el: 430, hi: [66.6,67.4,70.9,75.6,80.3,88.5,95.4,96.2,92.3,82.9,75.0,66.5], lo: [41.1,42.3,44.6,47.7,52.4,56.4,62.5,62.9,59.6,52.9,45.3,40.1] },
    { n: 'Lake Elsinore', lat: 33.6861, lon: -117.3458, el: 386, hi: [65.7,67.1,71.5,76.5,82.0,90.2,96.5,97.8,93.2,83.1,73.2,65.0], lo: [41.9,42.7,45.8,48.7,53.8,58.3,64.1,64.8,61.2,53.9,45.9,40.3] },
    { n: 'Sacramento', lat: 38.5069, lon: -121.4950, el: 5, hi: [56.0,61.3,66.3,72.1,80.3,87.9,92.6,91.9,88.5,78.8,65.0,56.0], lo: [39.2,41.5,44.5,47.0,52.0,56.5,59.2,58.8,56.5,50.3,42.7,38.5] },
    { n: 'Redding', lat: 40.5175, lon: -122.2986, el: 152, hi: [57.2,61.0,65.7,71.8,82.0,91.9,99.9,98.1,92.3,79.4,64.4,56.0], lo: [37.7,40.1,43.2,47.0,54.3,62.4,67.0,63.9,58.2,50.2,41.5,37.2] },
    { n: 'Chico', lat: 39.6911, lon: -121.8211, el: 56, hi: [56.1,62.2,66.7,72.8,81.3,89.3,95.2,94.3,90.9,79.7,65.0,56.6], lo: [36.2,38.3,41.6,45.3,52.2,57.4,61.0,59.0,54.9,47.4,39.8,36.3] },
    { n: 'Stockton', lat: 37.8892, lon: -121.2258, el: 8, hi: [57.0,62.9,68.5,74.5,82.8,90.4,95.4,94.4,90.4,80.3,66.6,57.1], lo: [39.1,41.3,44.2,47.4,52.6,57.6,60.9,60.3,57.5,50.6,42.8,38.4] },
    { n: 'Modesto', lat: 37.6242, lon: -120.9506, el: 22, hi: [56.1,62.2,68.1,73.8,82.0,89.7,95.0,93.5,89.1,79.0,65.7,56.2], lo: [38.8,41.8,45.2,48.4,53.7,59.2,62.7,62.0,58.6,51.5,43.2,38.6] },
    { n: 'Fresno', lat: 36.7800, lon: -119.7194, el: 102, hi: [55.4,61.3,67.5,73.7,82.7,91.4,97.7,96.5,90.7,78.7,64.9,55.3], lo: [40.6,43.3,47.3,50.9,57.6,63.9,69.3,67.9,63.4,54.6,45.4,39.8] },
    { n: 'Visalia', lat: 36.3283, lon: -119.2997, el: 92, hi: [55.3,61.3,66.9,72.7,80.6,88.8,93.8,93.2,88.3,77.8,64.4,55.4], lo: [38.4,41.6,45.4,48.6,55.4,61.5,66.7,64.9,60.1,52.3,43.3,37.9] },
    { n: 'Bakersfield', lat: 35.4344, lon: -119.0542, el: 149, hi: [58.5,64.3,70.2,75.9,84.1,92.3,98.3,96.9,91.4,80.2,67.1,58.8], lo: [40.5,43.2,47.0,50.7,58.0,65.1,71.3,70.0,65.0,55.2,45.4,39.6] },
    { n: 'Auburn', lat: 38.9072, lon: -121.0839, el: 394, hi: [56.3,59.4,63.1,68.1,76.9,85.7,92.7,92.0,86.8,76.9,63.8,55.8], lo: [37.8,40.0,42.3,44.8,51.5,57.5,63.4,62.8,59.5,51.6,43.1,37.2] },
    { n: 'Grass Valley', lat: 39.2042, lon: -121.0681, el: 732, hi: [53.6,54.9,57.9,62.7,70.8,80.2,88.0,87.4,82.3,72.1,59.8,52.6], lo: [33.1,34.2,37.0,40.0,46.8,52.6,58.2,56.8,52.1,44.2,37.1,32.6] },
    { n: 'Sonora', lat: 37.9672, lon: -120.3872, el: 510, hi: [55.7,58.2,62.1,66.7,75.6,85.3,92.8,91.9,86.7,76.2,63.2,55.1], lo: [32.8,34.2,37.0,39.7,45.5,50.8,56.8,55.5,50.8,43.0,36.4,32.4] },
    { n: 'Three Rivers', lat: 36.4650, lon: -118.8619, el: 348, hi: [58.0,61.7,67.0,72.5,81.8,91.1,97.4,96.4,91.5,79.3,65.7,57.6], lo: [36.0,38.3,41.3,44.4,50.7,58.4,65.0,63.9,58.3,49.1,40.3,35.4] },
    { n: 'Blue Canyon', lat: 39.2775, lon: -120.7103, el: 1608, hi: [46.5,45.0,48.2,52.0,60.6,69.8,77.8,77.4,72.9,62.9,51.2,44.8], lo: [34.4,33.1,34.7,37.5,45.6,54.4,62.7,62.1,57.2,48.1,39.0,33.6] },
    { n: 'Yosemite Valley', lat: 37.7503, lon: -119.5897, el: 1225, hi: [47.5,51.2,56.7,63.1,70.5,80.5,89.2,89.0,83.0,70.9,56.0,45.9], lo: [28.5,30.2,33.5,37.6,44.5,51.0,57.4,56.8,51.4,41.3,32.5,27.8] },
    { n: 'Mammoth Lakes', lat: 37.6478, lon: -118.9617, el: 2379, hi: [41.2,41.0,45.5,51.2,60.4,70.3,77.8,77.4,71.3,60.7,49.3,41.4], lo: [16.6,17.7,22.2,27.1,34.5,42.2,48.9,47.4,39.8,30.2,23.2,17.1] },
    { n: 'Huntington Lake', lat: 37.2275, lon: -119.2206, el: 2140, hi: [43.3,44.4,46.3,50.1,56.3,65.8,73.6,74.4,68.2,58.3,49.2,44.1], lo: [23.9,23.1,25.9,28.9,35.8,42.5,49.1,49.0,43.7,36.5,30.5,25.3] },
    { n: 'Lodgepole', lat: 36.6044, lon: -118.7325, el: 2053, hi: [39.2,41.0,45.3,50.0,58.4,68.4,76.1,75.9,70.0,58.9,46.6,37.3], lo: [17.4,18.4,21.8,25.7,33.1,39.5,45.9,44.1,39.2,31.1,23.4,17.2] },
    { n: 'Bishop', lat: 37.3711, lon: -118.3581, el: 1250, hi: [56.3,59.3,67.1,73.7,82.8,93.5,99.7,98.0,90.0,77.6,64.2,54.5], lo: [23.5,26.4,31.3,36.7,44.2,51.4,56.7,54.0,47.2,37.4,27.0,22.1] },
    { n: 'Tahoe City', lat: 39.1678, lon: -120.1428, el: 1899, hi: [39.6,40.5,44.6,50.1,59.2,69.3,78.0,77.4,70.4,59.2,47.7,39.7], lo: [20.6,21.1,24.1,27.6,33.9,40.0,46.0,45.4,40.5,32.6,25.9,20.7] },
    { n: 'South Lake Tahoe', lat: 38.8983, lon: -119.9947, el: 1924, hi: [42.8,43.4,47.8,53.2,62.1,72.0,80.4,79.7,73.4,62.2,50.9,42.8], lo: [18.4,19.3,23.7,27.6,33.2,38.1,42.5,41.0,35.4,29.2,23.3,18.0] },
    { n: 'Truckee', lat: 39.3331, lon: -120.1730, el: 1775, hi: [41.8,44.5,49.6,54.8,64.3,74.8,83.8,83.8,76.2,64.6,50.9,40.5], lo: [16.1,17.6,21.2,25.2,31.4,35.8,41.4,40.3,34.1,27.5,21.2,15.0] },
    { n: 'Mount Shasta', lat: 41.3219, lon: -122.3178, el: 1101, hi: [44.4,47.6,52.7,59.0,68.1,76.0,85.2,84.3,77.9,64.3,50.1,42.7], lo: [27.2,28.1,31.0,34.1,40.4,46.2,51.0,49.4,44.2,37.5,30.9,26.9] },
    { n: 'Burney', lat: 40.8803, lon: -121.6547, el: 975, hi: [44.5,48.9,55.1,61.5,72.1,80.7,89.6,88.2,81.5,67.8,51.6,43.5], lo: [22.6,24.0,26.9,30.7,37.2,42.0,47.5,44.0,37.7,30.4,25.8,22.2] },
    { n: 'Yreka', lat: 41.7031, lon: -122.6414, el: 826, hi: [46.1,51.7,58.1,64.3,73.9,82.9,93.0,92.2,84.4,69.7,53.9,44.9], lo: [27.3,29.0,32.3,36.5,43.4,48.6,55.4,53.8,46.9,37.7,31.2,27.1] },
    { n: 'Alturas', lat: 41.4914, lon: -120.5644, el: 1334, hi: [43.0,46.6,52.7,58.4,67.9,78.2,89.1,87.3,79.7,65.7,50.8,41.0], lo: [20.6,23.0,26.5,30.1,37.2,42.2,47.2,44.2,37.2,29.3,24.5,20.0] },
    { n: 'Susanville', lat: 40.4167, lon: -120.6631, el: 1284, hi: [42.7,47.6,54.2,60.5,69.3,78.9,88.0,86.6,80.0,67.0,51.9,42.6], lo: [22.3,25.6,29.6,33.8,40.2,47.0,53.1,52.0,45.3,35.9,28.1,22.3] },
    { n: 'Barstow-Daggett', lat: 34.8536, lon: -116.7858, el: 584, hi: [61.4,65.5,72.6,79.5,88.9,99.4,105.0,103.9,96.3,83.2,69.6,59.9], lo: [36.2,40.1,45.6,51.3,59.5,67.9,74.2,73.1,66.0,54.4,42.5,35.0] },
    { n: 'Lancaster', lat: 34.7411, lon: -118.2117, el: 713, hi: [58.7,61.5,67.2,72.9,81.6,91.3,97.6,97.8,91.4,80.0,67.0,57.7], lo: [31.3,34.5,39.8,44.9,53.4,61.5,67.2,64.7,56.9,45.8,35.0,29.7] },
    { n: 'Needles', lat: 34.7675, lon: -114.6189, el: 271, hi: [66.4,71.0,79.1,86.6,96.2,106.4,110.5,109.3,102.6,89.5,75.1,64.5], lo: [46.0,48.8,54.1,60.8,70.0,79.6,86.6,85.4,77.3,64.6,52.5,45.0] },
    { n: 'Victorville', lat: 34.5292, lon: -117.2928, el: 878, hi: [58.4,61.0,66.8,73.1,81.4,91.4,97.5,97.0,91.2,79.3,66.9,56.9], lo: [33.2,35.9,40.1,44.2,50.9,58.0,64.2,63.3,57.6,47.3,37.6,32.5] },
    { n: 'China Lake', lat: 35.6875, lon: -117.6931, el: 680, hi: [60.1,64.6,71.9,78.7,88.2,98.5,104.6,103.3,95.2,82.7,69.4,59.5], lo: [30.8,35.4,41.8,47.4,55.5,63.7,70.4,68.6,60.5,48.5,36.8,30.3] },
    { n: 'Palm Springs', lat: 33.8281, lon: -116.5053, el: 128, hi: [70.5,73.7,80.6,86.7,94.7,103.6,108.6,108.1,101.8,91.1,78.7,69.2], lo: [47.6,49.7,54.4,59.1,65.9,72.7,79.4,79.8,74.4,64.5,53.4,46.2] },
    { n: 'Indio', lat: 33.7086, lon: -116.2153, el: -6, hi: [70.3,73.3,79.9,85.8,93.1,101.7,105.8,105.2,100.8,90.5,78.0,68.8], lo: [46.8,51.0,57.2,63.1,69.3,76.6,82.5,82.5,76.5,65.8,53.0,45.3] },
    { n: 'Imperial', lat: 32.8342, lon: -115.5786, el: -18, hi: [70.5,73.7,80.1,86.3,94.3,103.5,107.8,107.7,102.2,90.4,78.3,68.7], lo: [41.5,45.2,50.6,55.5,62.1,70.2,78.4,79.4,72.2,60.0,48.4,41.2] },
    { n: 'Blythe', lat: 33.6186, lon: -114.7142, el: 120, hi: [68.2,72.3,79.6,87.0,95.5,105.0,108.5,107.7,102.0,89.9,76.8,66.4], lo: [43.2,46.2,51.6,57.3,65.2,73.4,81.5,81.7,74.0,61.0,49.1,41.7] },
    { n: 'Death Valley', lat: 36.4622, lon: -116.8669, el: -59, hi: [67.2,73.7,82.6,91.0,100.7,111.1,117.4,115.9,107.7,93.3,77.4,65.6], lo: [42.5,49.0,57.1,64.8,75.0,84.0,91.0,88.7,79.1,64.4,50.5,41.1] },
    { n: 'Big Bear Lake', lat: 34.2431, lon: -116.9169, el: 2058, hi: [46.1,45.7,51.2,57.3,65.8,75.1,79.7,78.7,73.0,63.4,53.5,46.2], lo: [23.6,23.7,27.0,31.0,37.2,43.5,50.5,49.5,44.0,35.0,27.8,23.5] },
    { n: 'Idyllwild', lat: 33.7572, lon: -116.7067, el: 1640, hi: [55.3,54.5,59.2,63.9,71.0,80.3,85.3,85.8,80.8,71.6,61.8,54.2], lo: [30.8,30.4,32.0,35.2,40.9,47.8,55.2,55.4,50.1,42.0,34.8,30.3] },
    { n: 'Sandberg', lat: 34.7436, lon: -118.7242, el: 1375, hi: [52.3,53.0,57.3,62.0,70.2,79.9,87.7,88.3,82.7,71.3,59.9,51.6], lo: [38.6,38.3,40.6,42.7,49.2,57.5,64.8,65.3,61.2,52.5,44.0,37.6] },
  ];
  const f2c = f => (f - 32) / 1.8, c2f = c => c * 1.8 + 32;
  /* the ground's height at a place: its ZIP's, where the page's data has it (the hazard job's elevation at the town point) */
  const elevAt = (la, lo) => { const zp = zipAt(la, lo), z = zp ? ZI[zp] : null; return z ? wxCol(z, 'elev') : null; };
  const climAt = (la, lo) => { const el = elevAt(la, lo), near = { d: 1e9, n: '' }, rows = CLIM.map(s => { const km = meters([la, lo], [s.lat, s.lon]) / 1000, d = km + (el == null ? 0 : Math.abs(el - s.el) / 10); if (d < near.d) { near.d = d; near.n = s.n; near.km = km; } return [d, s]; }).sort((x, y) => x[0] - y[0]).slice(0, 4);
    let W = 0, ez = 0; const hi = new Array(12).fill(0), lw = new Array(12).fill(0); rows.forEach(([d, s]) => { const w = 1 / Math.pow(Math.max(d, 4), 2); W += w; ez += s.el * w; for (let m = 0; m < 12; m++) { hi[m] += s.hi[m] * w; lw[m] += s.lo[m] * w; } });
    const adj = el == null ? 0 : -(el - ez / W) * 0.0065 * 1.8; return { hi: hi.map(v => v / W + adj), lo: lw.map(v => v / W + adj), near: near.n, km: near.km, el }; };
  const climMemo = new Map(), climOf = (la, lo) => { const k = la.toFixed(1) + ',' + lo.toFixed(1); let v = climMemo.get(k); if (!v) { v = climAt(la, lo); climMemo.set(k, v); } return v; };
  /* the air through the day: coolest at six by the sun, warmest at three (degrees Celsius) */
  function airC(la, lo, month, hour) { const c = climOf(la, lo), hi = f2c(c.hi[month]), lw = f2c(c.lo[month]), h = ((hour % 24) + 24) % 24, f = h >= 6 && h <= 15 ? 0.5 - 0.5 * Math.cos(Math.PI * (h - 6) / 9) : 0.5 + 0.5 * Math.cos(Math.PI * ((h < 6 ? h + 24 : h) - 15) / 15); return lw + (hi - lw) * f; }
  /* the sun by the day of the year and the hour by the sun: its height, and its direction as the engine's axes have it (x east, y up, z south) */
  function sunAt(doy, hour, la) { const dec = rad(23.44) * Math.sin(2 * Math.PI * (284 + doy) / 365), ha = rad(15 * (hour - 12)), p = rad(la), sa = Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(ha), alt = Math.asin(clamp(sa, -1, 1)), ca = Math.cos(alt) || 1e-9;
    const e = -Math.cos(dec) * Math.sin(ha) / ca, n = (Math.sin(dec) - Math.sin(p) * sa) / (Math.cos(p) * ca || 1e-9); return { alt: deg(alt), dir: [e * ca, sa, -n * ca] }; }
  /* clear sky sunlight on a plane facing the sun, and scattered light on level ground (W per square metre) */
  function clearSky(altDeg) { if (!(altDeg > 0)) return { dn: 0, dh: 0 }; const am = 1 / (Math.sin(rad(altDeg)) + 0.50572 * Math.pow(altDeg + 6.07995, -1.6364)), dn = 1353 * Math.pow(0.7, Math.pow(am, 0.678)); return { dn, dh: 0.1 * dn }; }
  /* what the engine's weather does to that sunlight: the share of the direct beam that arrives, and the scattered light as a share of the clear beam */
  const SKYK = { clear: [1, 0.1], haze: [0.75, 0.17], cloudy: [0.5, 0.26], overcast: [0.08, 0.3], rain: [0.04, 0.2] };
  const SIGMA = 5.670374e-8;
  /* the surface temperature (Celsius) of a plane that absorbs q watts per square metre of sunlight: emittance e, air ta, wind v (m/s), sky colder than the air by dsky */
  function surfaceC(q, e, ta, v, dsky) { const hc = 5.7 + 3.8 * (isN(v) ? v : 1.65), Ta = ta + 273.15, Ts4 = Math.pow(Ta - (isN(dsky) ? dsky : 10), 4); let T = Ta + q / (hc + 6); for (let i = 0; i < 6; i++) { const f = hc * (T - Ta) + e * SIGMA * (Math.pow(T, 4) - Ts4) - q, d = hc + 4 * e * SIGMA * T * T * T; T -= f / d; } return T - 273.15; }
  /* how much sunlight each covering sends back (dark to light) and how well it sheds heat as radiation, as measured:
     shingles 0.03 to 0.10 dark, 0.12 to 0.22 mid, 0.25 to 0.31 white, emittance 0.91 (Florida Solar Energy Center);
     painted metal 0.06 to 0.13 dark, 0.55 to 0.69 white, emittance 0.83 to 0.90; clay tile about 0.35, concrete tile 0.16
     to 0.25, slate 0.1 to 0.2; membranes from dark modified bitumen at 0.08 to white TPO and PVC at 0.70 after three years
     (Cool Roof Rating Council); the Energy Code's own default for an unrated asphalt shingle is an aged reflectance of
     0.08, and 0.10 for any other unrated product; bare 55 percent aluminium zinc steel reflects
     0.65 but its emittance is only 0.08 to 0.28 (Oak Ridge; Florida Solar Energy Center), so it runs hotter than its brightness suggests, and metal
     building roofs here are a mix of that and paint. Wood shakes are taken with mid toned shingles and a house's low
     slope roof with the membranes (no measurement of either was found). */
  const ROOFOPT = { shingle: { sr: [0.04, 0.26], e: 0.91 }, wood: { sr: [0.1, 0.3], e: 0.9 }, flat: { sr: [0.08, 0.68], e: 0.88 }, metal: { sr: [0.08, 0.62], e: 0.85 }, tile: { sr: [0.12, 0.4], e: 0.9 }, mh: { sr: [0.2, 0.65], e: 0.8 }, low: { sr: [0.08, 0.68], e: 0.88 }, lowmf: { sr: [0.08, 0.68], e: 0.88 }, mbldg: { sr: [0.25, 0.62], e: 0.4 } };
  /* the reflectance a roof most likely has: the middle of its covering's range, moved by how light the roof shows in the
     satellite photo (lum, 0 to 1 as displayed; the photo's brightness is not a measurement, so it only places the roof within the range) */
  function reflectOf(type, lum) { const r = (ROOFOPT[type] || ROOFOPT.shingle).sr; if (!isN(lum)) return r[0] + (r[1] - r[0]) * 0.35; const t = clamp((lum - 0.22) / 0.5, 0, 1); return r[0] + (r[1] - r[0]) * t * t * (3 - 2 * t); }
  const optOf = (types, lum) => { let sr = 0, e = 0, W = 0; types.forEach(([k, w]) => { const o = ROOFOPT[k] || ROOFOPT.shingle; sr += reflectOf(k, lum) * w; e += o.e * w; W += w; }); return W ? { sr: sr / W, e: e / W } : { sr: 0.12, e: 0.9 }; };
  /* sunlight on a plane (normal n, unit length): direct by the cosine, scattered light by how much sky it sees, a little off the ground */
  const planeSun = (n, sun, sky, k, shade) => { const cs = Math.max(0, n[0] * sun.dir[0] + n[1] * sun.dir[1] + n[2] * sun.dir[2]), up = (1 + n[1]) / 2, gh = sky.dn * k[0] * Math.max(0, sun.dir[1]) + sky.dn * k[1]; return sky.dn * k[0] * cs * (1 - (shade || 0)) + sky.dn * k[1] * up + 0.2 * gh * (1 - up); };
  /* how fast heat ages a plane over a normal year, against a plane held at 25 C: the rate doubles for each 10 C (the rule of
     thumb for the oxidation that hardens asphalt and plastics), averaged over every hour of twelve mid month days with the
     sky clear a share of the time that falls with the place's rain: nine tenths less a hundredth for each inch of
     normal yearly rain, held between a half and nine tenths (a judgment: the page's data carries no sunshine record;
     the deserts come out near 0.85, Los Angeles 0.75, San Francisco 0.67, Eureka 0.5). No shade is counted: the
     yearly rate knows the plane's slope, its bearing and the roof's colour, not the trees round it. */
  const clearShare = (la, lo) => { const zp = zipAt(la, lo), r = zp && ZI[zp] ? wxCol(ZI[zp], 'rainIn') : null; return r == null ? 0.7 : clamp(0.9 - r / 100, 0.5, 0.9); };
  const HEATM = new Map(), MIDDOY = [15, 46, 75, 106, 136, 167, 197, 228, 259, 289, 320, 350];
  function heatRate(sr, e, n, la, lo) {
    /* the answer is for the rounded place and colour the memo is keyed by (a tenth of a degree, about 10 km: California's air changes that fast between the beach, the valley and the pass; a hundredth), so it does not depend on which roof asked first */
    sr = Math.round(sr * 100) / 100; e = Math.round(e * 100) / 100; la = Math.round(la * 10) / 10; lo = Math.round(lo * 10) / 10; const cs = clearShare(la, lo);
    const tilt = Math.round(deg(Math.acos(clamp(n[1], -1, 1))) / 5) * 5, az = tilt < 3 ? 0 : Math.round(((deg(Math.atan2(n[0], -n[2])) + 360) % 360) / 22.5) * 22.5, key = [sr.toFixed(2), e.toFixed(2), tilt, az, la.toFixed(1), lo.toFixed(1)].join('|'); let v = HEATM.get(key); if (v !== undefined) return v;
    const t = rad(tilt), a = rad(az), nn = [Math.sin(t) * Math.sin(a), Math.cos(t), -Math.sin(t) * Math.cos(a)]; let s = 0, c = 0;
    for (let m = 0; m < 12; m++) for (let h = 0; h < 24; h++) { const sun = sunAt(MIDDOY[m], h + 0.5, la), sky = clearSky(sun.alt), ta = airC(la, lo, m, h + 0.5);
      [[SKYK.clear, cs, 10], [SKYK.overcast, 1 - cs, 3]].forEach(([k, w, ds]) => { const T = surfaceC((1 - sr) * planeSun(nn, sun, sky, k, 0), e, ta, 1.65, ds); s += w * Math.pow(2, (T - 25) / 10); c += w; }); }
    v = s / c; if (HEATM.size > 12000) HEATM.clear(); HEATM.set(key, v); return v;
  }
  /* the average roof of a kind here: a 6 in 12 slope facing every way in turn (2 degrees for the low slope kinds), about a
     third of the way up its range of colours */
  const heatRef = (type, la, lo) => { const o = ROOFOPT[type] || ROOFOPT.shingle, sr = reflectOf(type, null), low = type === 'low' || type === 'lowmf' || type === 'mbldg' || type === 'flat', t = rad(low ? 2 : 26.6); let s = 0; for (let k = 0; k < 8; k++) { const a = rad(k * 45); s += heatRate(sr, o.e, [Math.sin(t) * Math.sin(a), Math.cos(t), -Math.sin(t) * Math.cos(a)], la, lo); } return s / 8; };

  /* ---------- the roof views of the Scout Engine: plane by plane ---------- */
  /* The engine cuts every roof near the camera into small triangles and asks, for each corner, what to draw there. It
     tells what it knows of the place: the plane's normal, how near the corner is to an eave, a roof corner or a ridge
     (ASCE 7 puts the hardest uplift there; on the ground IBHS found shingle damage after two 2008 storms about as often
     in the middle of a slope as along its edge, rarer but worse at corners, with hip and ridge caps the first thing
     lost, so the views lean on ridges and hips and only a little on edges), how much of the sun a tree or a neighbour
     blocks there at this hour, whether a crown hangs over it, and how light the roof shows in the photograph. The
     answers are numbers on fixed scales, so two roofs, two hours and two years compare. Row picks the colours. Marks are
     specks the engine scatters: 1 cover lost to wind, 2 hail hits, 3 worn patches, 4 moss or algae, 5 rust (and, in the
     Fire view, where embers lodge), 6 a leak; from 7 up the mark is the covering's own pattern. */
  const LENS_T = [40, 200];   /* the thermal scale, degrees Fahrenheit */
  const LENS_ROW = { thermal: 0, wear: 1, wind: 2, hail: 3, wear_t: 4, rain: 5, leak: 5, rust: 6, algae: 7, shingle: 8, metal: 9, tile: 10, low: 11, flat: 11, lowmf: 11, lowW: 12, mh: 13, mbldg: 14, tab3: 15, lam: 16, other: 17, storm: 18, wood: 19, fire: 20, fclass: 21, snow: 22, solar: 23, tileC: 24 };
  const LENS_PAL = [
    ['#05061a', '#1a0f5c', '#5b1392', '#a01d86', '#d53f58', '#f0752a', '#f9b223', '#fde96a', '#ffffff'],                /* heat: the ironbow of a thermal camera */
    ['#1d6b4a', '#4f9a4a', '#a8bf3f', '#f0c53a', '#ee8a2e', '#d94a2a', '#8c1d3a'],                                      /* wear: sound to worn out */
    ['#0c2233', '#12507a', '#1f86c9', '#58c0ff', '#d6f1ff'],                                                            /* wind */
    ['#1e1233', '#4a2584', '#8448d6', '#c08cff', '#f1e2ff'],                                                            /* hail */
    ['#33210c', '#7a4a12', '#c9801f', '#ffb347', '#fff0cf'],                                                            /* heat, sun and age */
    ['#0c2e2c', '#136b66', '#1fb3a8', '#6fe6da', '#dcfffb'],                                                            /* rain and leaks */
    ['#2e140c', '#7a2e13', '#c4501f', '#f0845a', '#ffe1d4'],                                                            /* rust */
    ['#16260f', '#35591f', '#5d9134', '#9fd06a', '#e9ffd4'],                                                            /* moss and algae */
    ['#2b3140', '#56627a', '#93a5cc'],                                                                                  /* covering: asphalt shingles */
    ['#0f3340', '#1f7f9a', '#62d6f0'],                                                                                  /* covering: metal on a house */
    ['#40180c', '#a8451f', '#f38d4c'],                                                                                  /* covering: clay tile */
    ['#2a2233', '#5d4a78', '#a98fd6'],                                                                                  /* covering: a dark low slope roof (cap sheet, built up, modified bitumen) */
    ['#5a5f66', '#b4bcc6', '#f5f8fb'],                                                                                  /* covering: a white membrane or cool coating */
    ['#33300f', '#7d7526', '#d9ce58'],                                                                                  /* covering: a manufactured home roof */
    ['#0f3326', '#218a63', '#63e0b0'],                                                                                  /* covering: metal building panels */
    ['#101c3a', '#2a57c0', '#82abff'],                                                                                  /* shingle style: three tab */
    ['#3a2408', '#c07a14', '#ffc85c'],                                                                                  /* shingle style: laminated */
    ['#1c1f24', '#3b4048', '#6a717c'],                                                                                  /* not shingles */
    ['#10202c', '#235a7a', '#d9c23a', '#ea7a28', '#cf2a22', '#7e1040'],                                                 /* the weather on the scales: untouched to stripped */
    ['#2e2114', '#6e4f2c', '#b98a52'],                                                                                  /* covering: wood shakes */
    ['#2a0d06', '#7a1f0c', '#d8421a', '#ff8a3c', '#ffe3b0'],                                                            /* wildfire */
    ['#1f7a4d', '#7fb23f', '#e6c53a', '#ea7a28', '#b3261e'],                                                            /* fire class: Class A to unrated */
    ['#0d1b2e', '#27507e', '#6fa3d8', '#cfe4f7', '#ffffff'],                                                            /* snow load: none to the design load */
    ['#141433', '#3b2f7d', '#8a4a9c', '#d9725a', '#f7c14a', '#fff7c2'],                                                 /* the sun a plane takes in a year */
    ['#3a2a22', '#8a6a58', '#cdb3a2'],                                                                                  /* covering: concrete tile */
  ];
  const CAUSE_COL = { wind: '#58c0ff', hail: '#c08cff', wear: '#ffb347', rain: '#6fe6da', leak: '#6fe6da', rust: '#f0845a', algae: '#9fd06a', fire: '#ff8a3c' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const faceOf = n => (n[1] > 0.985 ? 'level' : 'faces ' + compass((deg(Math.atan2(n[0], -n[2])) + 360) % 360));
  /* Laminated (architectural, dimensional) shingles' share of the asphalt shingles sold in the United States, by year:
     7 percent in 1984 and 23 in 1994 (Elcor's annual reports), 27 in 1996, 36 in 1998, 46 in 2000 and 59 in 2003 (GAF's),
     over 65 in 2006 (ElkCorp), 70 in 2010 (Fine Homebuilding), about 86 over 2015 to 2020, 91 in 2021, 93 in 2022 and
     2023 and 95 in 2024 and 2025 (Owens Corning; only the 95 is printed: its chart has no labels and gives 2015 to 2020
     as one average, which is spread here from 83 to 89, a judgment). 1980 is 5 (ARMA, at second hand) and is held for
     every year before it; 2002, 2004 and 2006 sit between two readings each; 2011 to 2014 were not found and are drawn
     straight between. The rest of each year's shingles are three tab strips. These are national figures: no split for
     California was found. Sacramento's permits name the shingle outright ("30yr Laminated Dimensional Composition"). */
  const LAM = [[1980, 0.05], [1984, 0.07], [1994, 0.23], [1996, 0.27], [1998, 0.36], [2000, 0.46], [2002, 0.53], [2003, 0.59], [2004, 0.61], [2006, 0.66], [2010, 0.70], [2015, 0.83], [2018, 0.86], [2021, 0.91], [2022, 0.93], [2023, 0.93], [2024, 0.95], [2025, 0.95]];
  const lamAt = y => { if (y <= LAM[0][0]) return LAM[0][1]; for (let i = 1; i < LAM.length; i++) if (y <= LAM[i][0]) { const a = LAM[i - 1], c = LAM[i]; return a[1] + (c[1] - a[1]) * (y - a[0]) / (c[0] - a[0]); } return LAM[LAM.length - 1][1]; };
  /* a roof's age today as a spread of chances, from the outlook's clock (O.older(n): the chance it is more than n years old), or its one likely age without one */
  function ageSpread(b, O, max) {
    const out = []; max = max || 90;
    if (O && O.older) { let prev = 1; for (let a = 0; a <= max; a++) { const nx = a === max ? 0 : clamp(O.older(a), 0, prev), w = prev - nx; if (w > 1e-5) out.push([a, w]); prev = nx; } }
    if (!out.length) out.push([clamp(Math.round((b.state && b.state.age) || 15), 0, max), 1]);
    const t = out.reduce((s, x) => s + x[1], 0) || 1; out.forEach(x => { x[1] /= t; }); return out;
  }
  /* which shingle: the chance it is laminated, by the years it may have gone on */
  function styleOf(b, O) { const sp = ageSpread(b, O); let lam = 0, yr = 0; sp.forEach(([a, w]) => { lam += w * lamAt(THIS_YEAR - a); yr += w * (THIS_YEAR - a); }); return { lam: clamp(lam, 0, 1), year: Math.round(yr) }; }
  /* The coverings the views tell apart: the row of colours each takes, and the pattern the Scout Engine draws in the plane
     of the roof, each at one common size of that covering: 7 three tab strips, 8 laminated shingles, 9 standing seam
     (seams at 16 inches), 10 ribbed panels with their screws showing, 11 barrel (mission) clay tile, 13 a white
     membrane (10 ft sheets), 14 a cap sheet or other dark roll roofing (metre wide rolls); and, where the engine
     carries California's patterns (ENGX.pat), 15 flat concrete tile (13 inches to the weather, 12 wide, courses broken
     half a tile), 16 S tile (the one piece clay or concrete S: 13 inch courses, crowns at 11 3/4 inches), 17 wood shakes
     (10 inch exposure, shakes 4 to 12 inches wide), 18 a gravel surfaced built up roof and 19 rooftop solar panels.
     Without them the nearest older pattern stands in. Sizes are from makers' data sheets. */
  const ENGX = { pat: 14 };   /* the highest pattern number the engine in the page can draw; the engine bar reads it from the engine */
  const patOf = p => (p <= ENGX.pat ? p : p === 15 || p === 16 ? 11 : p === 17 ? 8 : p === 18 ? 14 : 14);
  const COVER = {
    shingle: { row: 8, pat: 8, l: 'Asphalt shingles', s: 'shingles' },
    tile: { row: 10, pat: 16, l: 'Tile (clay or concrete)', s: 'tile', d: 'clay more often than concrete by the survey; drawn as S tile, or flat tile where concrete is the likelier' },
    wood: { row: 19, pat: 17, l: 'Wood shakes or shingles', s: 'wood shakes' },
    metal: { row: 9, pat: 9, l: 'Metal on a house', s: 'metal', d: 'drawn as standing seam; the records cannot tell it from ribbed panels or stone coated steel' },
    flat: { row: 11, pat: 14, l: 'Low slope roof on a house', s: 'a low slope roof', d: 'cap sheet, built up or single ply' },
    low: { row: 11, pat: 14, l: 'Low slope membrane', s: 'membrane' }, lowmf: { row: 11, pat: 14, l: 'Low slope membrane', s: 'membrane' },
    mh: { row: 13, pat: 10, l: 'Manufactured home roof', s: 'manufactured home roof', d: 'metal on older single wides, shingles on pitched double wides; drawn as ribbed metal' },
    mbldg: { row: 14, pat: 10, l: 'Metal building panels', s: 'metal panels', d: 'ribbed panels, their screws showing' },
  };
  const COVER_KEY = [['shingle', 'Asphalt shingles'], ['tile', 'Clay tile'], ['tileC', 'Concrete tile'], ['wood', 'Wood shakes or shingles'], ['metal', 'Metal on a house'], ['low', 'Low slope, dark (cap sheet, built up, modified bitumen)'], ['lowW', 'Low slope, white (TPO, PVC or a cool coating)'], ['mh', 'Manufactured home roof'], ['mbldg', 'Metal building panels']];
  const isLowK = k => k === 'low' || k === 'lowmf' || k === 'flat';
  const coverRow = (k, lum) => (isLowK(k) && isN(lum) && lum >= 0.55 ? 12 : (COVER[k] || COVER.shingle).row);
  const photoWord = lum => (!isN(lum) ? '' : lum < 0.3 ? 'dark' : lum < 0.42 ? 'mid toned' : lum < 0.58 ? 'light' : 'very light');

  /* ---------- the weather on the engine's scales, and what it would do to a roof ---------- */
  /* Two scales and a sky, as the Scout Engine runs them. The rain scale: dry, light rain, rain, a thunderstorm, and
     atmospheric rivers of rank 1 to 5 on the scale of Ralph and others (2019: the rank is set by the water vapour a
     storm carries and how long it stays, not by wind or rain at a street). The dry wind scale: calm, a breeze, and
     four steps of offshore wind (Santa Ana in the south, Diablo in the north) from an advisory to an extreme day. For
     the roof readings each step needs a gust and, for rain, a share of a year's leaks; the engine's own figures are
     used when it gives them, else these: gusts in mph, a judgment anchored on the Weather Service's usual criteria (a wind
     advisory from gusts of 46 mph, a high wind warning from 58) and on January 7, 2025, when Burbank Airport gusted
     to 84 mph and Saddle Peak to 98 (NOAA Storm Events). leak: the share of a year's leak calls a storm of that step
     brings (a judgment, grade D: no count of leak claims by storm was found; the one demand record is that Los
     Angeles issued 40 percent more re-roof permits in 2023, after the wet winter of 2022 to 2023, than in
     2022). swe: inches of water the storm leaves as snow above its snow level (judgment), and snowM that level in
     metres (warm, strong atmospheric rivers snow high). */
  const WX_RAIN = [
    { id: 'dry', l: 'Dry', t: 'Dry', gust: 0, leak: 0, swe: 0, snowM: 0 },
    { id: 'light', l: 'Light rain', t: 'Light', gust: 10, leak: 0.03, swe: 0.2, snowM: 1700 },
    { id: 'rain', l: 'Rain', t: 'Rain', gust: 20, leak: 0.10, swe: 0.8, snowM: 1600 },
    { id: 'tstorm', l: 'Thunderstorm', t: 'T-storm', gust: 50, leak: 0.08, swe: 0.4, snowM: 2400 },
    { id: 'ar1', l: 'Atmospheric river, rank 1 (weak)', t: 'AR 1', gust: 25, leak: 0.10, swe: 1.0, snowM: 1700 },
    { id: 'ar2', l: 'Atmospheric river, rank 2 (moderate)', t: 'AR 2', gust: 35, leak: 0.18, swe: 2.0, snowM: 1800 },
    { id: 'ar3', l: 'Atmospheric river, rank 3 (strong)', t: 'AR 3', gust: 45, leak: 0.30, swe: 3.5, snowM: 2000 },
    { id: 'ar4', l: 'Atmospheric river, rank 4 (extreme)', t: 'AR 4', gust: 55, leak: 0.45, swe: 5.5, snowM: 2200 },
    { id: 'ar5', l: 'Atmospheric river, rank 5 (exceptional)', t: 'AR 5', gust: 65, leak: 0.60, swe: 8.0, snowM: 2400 },
  ];
  const WX_WIND = [
    { id: 'calm', l: 'Calm', t: 'Calm', gust: 0 },
    { id: 'breeze', l: 'Breeze', t: 'Breeze', gust: 20 },
    { id: 'sa1', l: 'Offshore wind: advisory', t: 'Advisory', gust: 46 },
    { id: 'sa2', l: 'Offshore wind: high wind warning', t: 'Warning', gust: 62 },
    { id: 'sa3', l: 'Offshore wind: damaging', t: 'Damaging', gust: 78 },
    { id: 'sa4', l: 'Offshore wind: extreme', t: 'Extreme', gust: 95 },
  ];
  const WX_SKY = [['clear', 'Clear'], ['marine', 'Marine layer'], ['tule', 'Tule fog'], ['smoke', 'Wildfire smoke']];
  const rainStep = id => WX_RAIN.find(x => x.id === id) || WX_RAIN[0], windStep = id => WX_WIND.find(x => x.id === id) || WX_WIND[0];
  /* what the scales stand at: the engine bar keeps this as it sets them, and the engine's own word is read when it gives one */
  const WXNOW = { rain: 'dry', wind: 'calm', sky: 'clear', elev: null, engine: false };
  const stepId = (s, list) => (s && typeof s === 'object' && list.some(x => x.id === s.id) ? s.id : typeof s === 'string' && list.some(x => x.id === s) ? s : null);
  const gustOf = (own, eng) => { const g = eng && isN(+eng.gust) && +eng.gust > 5 && +eng.gust < 200 ? +eng.gust : null; return g != null ? g : own.gust; };
  function wxResolve(ctx) {
    ctx = ctx || {}; const rid = stepId(ctx.stormStep, WX_RAIN) || WXNOW.rain, wid = stepId(ctx.windStep, WX_WIND) || WXNOW.wind, r = rainStep(rid), w = windStep(wid);
    const rg = gustOf(r, stepId(ctx.stormStep, WX_RAIN) ? ctx.stormStep : null), wg = gustOf(w, stepId(ctx.windStep, WX_WIND) ? ctx.windStep : null), sky = (typeof ctx.sky === 'string' && WX_SKY.some(x => x[0] === ctx.sky) ? ctx.sky : WXNOW.sky) || 'clear';
    const snowM = ctx.stormStep && isN(+ctx.stormStep.snowLevel) && +ctx.stormStep.snowLevel > 0 ? +ctx.stormStep.snowLevel : r.snowM;
    return { rain: r, wind: w, sky, gust: Math.max(rg, wg), rainGust: rg, windGust: wg, snowM, elev: isN(ctx.elev) ? +ctx.elev : WXNOW.elev };
  }
  /* The share of roofs a day with that gust damages enough for a roofer (shingles of average age, one story): the atlas's
     stated rates at 58 and 75 mph (OC.wind), drawn through as a straight line on a log scale and carried on to 100 mph
     and back to 40 on the same line; nothing below 40, never over 5 percent. Past 75 mph it is an extrapolation with no
     count behind it: California's reports say "countless roofs" (October 21, 2007, gusts over 70 mph) and give no
     number. Grade D. */
  const gustDmg = mph => { if (!(mph >= 40)) return 0; const a = OC.wind[0][0], b2 = OC.wind[1][0], k = Math.log(b2 / a) / 17; return Math.min(0.05, a * Math.exp(k * (mph - 58))); };
  const gustRepl = mph => clamp(0.2 + (mph - 58) * 0.2 / 17, 0.1, 0.7);
  /* The fire class a roof most likely carries as an assembly, [Class A, Class B, Class C, unrated], by covering and by
     the age of the roof. Anchors: about 90 percent of structures inside the 2025 Palisades and Eaton perimeters had
     Class A coverings by CAL FIRE's inspections and 80 percent of those IBHS examined; clay and concrete tile, metal
     and slate count as Class A assemblies on the decks and underlayments the code names; fiberglass asphalt shingles
     are sold as Class A, the older organic felt shingles as Class C; wood shakes are Class B when pressure treated (A
     over a special underlayment) and unrated when not, and Los Angeles has restricted wood roofs since 1989 and now allows none. The split
     by age (a roof of 30 years or more is likelier to be of the older kind) is a judgment, grade D. */
  const FCLS = {
    shingle: [[0.93, 0.03, 0.04, 0], [0.62, 0.05, 0.33, 0]], tile: [[0.95, 0.03, 0.02, 0], [0.9, 0.05, 0.05, 0]], metal: [[0.92, 0.05, 0.03, 0], [0.88, 0.06, 0.06, 0]],
    wood: [[0.15, 0.65, 0.1, 0.1], [0.02, 0.18, 0.1, 0.7]], flat: [[0.85, 0.1, 0.05, 0], [0.7, 0.15, 0.15, 0]], low: [[0.88, 0.09, 0.03, 0], [0.75, 0.15, 0.1, 0]], lowmf: [[0.88, 0.09, 0.03, 0], [0.75, 0.15, 0.1, 0]],
    mh: [[0.6, 0.1, 0.25, 0.05], [0.45, 0.1, 0.35, 0.1]], mbldg: [[0.92, 0.05, 0.03, 0], [0.88, 0.06, 0.06, 0]],
  };
  function fireClass(b, O) {
    const types = typesOf(b), W = types.reduce((s, x) => s + x[1], 0) || 1, sp = ageSpread(b, O, 90), pOld = sp.reduce((s, [a, w]) => s + (a >= 30 ? w : 0), 0), out = [0, 0, 0, 0];
    types.forEach(([k, w]) => { const F = FCLS[k] || FCLS.shingle; for (let i = 0; i < 4; i++) out[i] += w / W * (F[0][i] * (1 - pOld) + F[1][i] * pOld); });
    return { p: out, pOld, below: clamp(out[1] * 0.4 + out[2] * 0.7 + out[3], 0, 1) };
  }
  /* the class a re-roof here must be: Class A in a Fire Hazard Severity Zone when half the roof or more is replaced in a
     year (the 2025 Wildland-Urban Interface Code, 507.1; the 2022 codes said "more than 50 percent"), and for any part
     repaired or replaced; outside the zones the statute's floor (Health and Safety Code 13132.7: Class C, Class B in
     State Responsibility Areas) */
  const reroofClass = b => (!b.fhsz ? null : b.fhsz.cls >= 1 ? { c: 'A', why: `it stands in a ${b.fhsz.l} Fire Hazard Severity Zone (${b.fhsz.ra === 'SRA' ? 'State' : 'Local'} Responsibility Area)` } : { c: 'C', why: 'it is outside the mapped Fire Hazard Severity Zones (the statute\'s floor; a city may ask more)' });
  /* Ember exposure, an index from 0 to 1 and not a chance: how open a roof is to wind borne embers on a day of dry
     offshore wind. By the zone it stands in (Very High 1, High 0.8, Moderate 0.6, none 0.35: embers carried the 2017
     and 2025 fires past the mapped zones), by how near the record puts fire (inside a perimeter since 1950, or
     structures destroyed within 300 m), by the wind on the scale, and by the roof: its chance of being below Class A,
     with a floor because a Class A roof still takes embers at its edges, vents and gutters (IBHS: only 6 to 10 percent
     of structures in the 2025 fires had vent screens of 1/8 inch or finer). Judgment, grade D. */
  function emberIx(b, fc, gust) {
    const zk = !b.fhsz ? 0.5 : [0.35, 0.6, 0.8, 1][clamp(b.fhsz.cls, 0, 3)], hist = (b.fire && b.fire.nIn ? 0.15 : 0) + (b.near && b.near.dest ? 0.15 : 0), wk = gust >= 40 ? clamp(0.5 + (gust - 40) / 80, 0.5, 1.2) : 0.35;
    return clamp((zk + hist) * wk * (0.3 + 0.7 * fc.below), 0, 1);
  }
  /* The weather now on the scales, on one building: over its coverings and the ages its roof may be, the chance it needs a
     roofer for wind (replaced, repaired), the chance of a leak call in this storm, the snow this storm adds against the
     ground snow load the code designs for there, and its ember exposure when the sky is smoke or the wind is offshore. */
  function wxOnRoof(b, O, wx) {
    const types = typesOf(b), W = types.reduce((s, x) => s + x[1], 0) || 1, sp = ageSpread(b, O, AGE_MAX), st = O ? O.st : 1, hz = O ? O.hz : hazardAt(b.zip || ''), d = gustDmg(wx.gust), rs = gustRepl(wx.gust);
    let rep = 0, fix = 0, leak = 0;
    types.forEach(([k, w]) => { const T = RTYPE[k] || RTYPE.shingle, wk = T.wind * OC.tall(st); sp.forEach(([a, pa]) => { const q = w / W * pa, x = clamp(d * windAgeK(a, T.ageK) * wk, 0, 0.95); rep += q * x * rs; fix += q * x * (1 - rs); leak += q * clamp(repRate(a) * T.leak * (hz ? hz.rainK : 1) * wx.rain.leak, 0, 0.6); }); });
    const z = b.z, pg = wxCol(z, 'snow'), el = wx.elev != null ? wx.elev : wxCol(z, 'elev'), snowing = wx.rain.id !== 'dry' && el != null && wx.snowM > 0 && el >= wx.snowM, add = snowing ? wx.rain.swe * 5.2 : 0;
    const fc = fireClass(b, O), ember = wx.sky === 'smoke' || /^sa/.test(wx.wind.id) ? emberIx(b, fc, wx.windGust) : 0;
    return { rep, fix, any: rep + fix, leak, d, gust: wx.gust, snowing, add, pg, snowR: snowing && pg > 0 ? clamp(add / pg, 0, 1.5) : snowing ? null : 0, el, ember, fc, kind: snowing ? 'snow' : wx.gust >= 40 ? 'wind' : wx.rain.id !== 'dry' ? 'rain' : ember > 0 ? 'ember' : 'dry' };
  }
  /* the sun a plane takes in a normal year, kWh a square metre: the Thermal reading's clear sky sunlight on the plane, hour
     by hour over twelve mid month days, with the sky clear the place's share of the time (clearShare); no shade counted */
  const SUNY = new Map();
  function sunYear(n, la, lo) {
    la = Math.round(la * 10) / 10; lo = Math.round(lo * 10) / 10; const tilt = Math.round(deg(Math.acos(clamp(n[1], -1, 1))) / 5) * 5, az = tilt < 3 ? 0 : Math.round(((deg(Math.atan2(n[0], -n[2])) + 360) % 360) / 22.5) * 22.5, key = [tilt, az, la.toFixed(1), lo.toFixed(1)].join('|'); let v = SUNY.get(key); if (v !== undefined) return v;
    const t = rad(tilt), a = rad(az), nn = [Math.sin(t) * Math.sin(a), Math.cos(t), -Math.sin(t) * Math.cos(a)], cs = clearShare(la, lo); let s = 0;
    for (let m = 0; m < 12; m++) for (let h = 0; h < 24; h++) { const sun = sunAt(MIDDOY[m], h + 0.5, la), sky = clearSky(sun.alt); s += (cs * planeSun(nn, sun, sky, SKYK.clear, 0) + (1 - cs) * planeSun(nn, sun, sky, SKYK.overcast, 0)) * 30.4; }
    v = s / 1000; if (SUNY.size > 6000) SUNY.clear(); SUNY.set(key, v); return v;
  }
  const SUN_SC = [600, 2300];   /* the Solar view's scale, kWh a square metre a year */

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
          <div class="card sc-mapcard"><div class="sc-modebar"><div class="seg" id="scMode" role="group" aria-label="What the card shows"><button type="button" data-v="map" aria-pressed="true">Satellite</button><button type="button" data-v="3d" aria-pressed="false">Street view (3D)</button><button type="button" data-v="eng" aria-pressed="false" title="The neighborhood drawn by the Scout Engine: a renderer written for this page, with a physical sky, bounced light, reflections and traffic, and the roof views: heat, weather wear and the next 15 years">Scout Engine (3D)</button><button type="button" data-v="sv" aria-pressed="false">Google photos</button></div><span class="sc-mnote" id="scModeNote">Pick a building, then Street view to stand in the street in front of it (or double click the building).</span></div>
            <div class="sc-map" id="scMap" role="application" aria-label="Satellite map of Louisiana with the heatmap and buildings"></div>
            <div class="sc-svw" id="scSvw" hidden><div class="sc-svbar" id="scSvBar"></div><div class="sc-svj" id="scSvJ" hidden><div class="sc-svp" id="scSvP"></div><canvas class="sc-svc" id="scSvC" aria-hidden="true"></canvas></div><iframe class="sc-svf" id="scSvF" title="Google Street View" allowfullscreen referrerpolicy="no-referrer-when-downgrade" src="about:blank"></iframe></div>
            <div class="sc-3dw" id="sc3dW" hidden><div class="sc-svbar" id="sc3dBar"></div><div class="sc-3d" id="sc3D"><div class="sc-3dnote" id="sc3dNote"></div><div class="sc-3dpad" id="sc3dPad" role="group" aria-label="Walk and turn"><span></span><button type="button" data-k="fwd" title="Walk forward (W)" aria-label="Walk forward">▲</button><span></span><button type="button" data-k="left" title="Turn left (A)" aria-label="Turn left">◀</button><button type="button" data-k="back" title="Walk back (S)" aria-label="Walk back">▼</button><button type="button" data-k="right" title="Turn right (D)" aria-label="Turn right">▶</button></div><div class="sc-3dattr">Imagery: Esri, Vantor · Buildings: FEMA · Streets: © OpenStreetMap contributors, U.S. Census</div></div></div>
            <div class="sc-3dw sc-enw" id="scEnW" hidden><div class="sc-svbar" id="scEnBar"></div><div class="sc-3d sc-en" id="scEn"><div class="sc-3dnote" id="scEnNote"></div><div class="sc-3dpad" id="scEnPad" role="group" aria-label="Move and turn"><span></span><button type="button" data-k="fwd" title="Forward (W)" aria-label="Forward">▲</button><span></span><button type="button" data-k="left" title="Turn left (A)" aria-label="Turn left">◀</button><button type="button" data-k="back" title="Back (S)" aria-label="Back">▼</button><button type="button" data-k="right" title="Turn right (D)" aria-label="Turn right">▶</button><button type="button" data-k="up" class="sc-enalt" title="Climb (R or the up arrow)" aria-label="Climb" hidden>⤒</button><span class="sc-enalt" hidden></span><button type="button" data-k="down" class="sc-enalt" title="Descend (F or the down arrow)" aria-label="Descend" hidden>⤓</button></div><div class="sc-3dattr">Imagery: Esri, Vantor · Buildings: FEMA USA Structures, © OpenStreetMap contributors · Streets: © OpenStreetMap contributors, U.S. Census · Windows, cars, signals, sidewalks and rooftop equipment are generated, not observed · The roof views are a model, not an inspection</div></div></div>
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
        if (d3Mode) refresh3D(); if (enMode) refreshEn();
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
        t.st = 'ok'; t.force = false; refreshSoon(); tryPending(); if (svMode) drawSoon(); if (d3Mode) refresh3D(); if (enMode) refreshEn();
        if (sel && sel.type === 'b' && t.ids.has(sel.id)) detail();
      }
      function evict() {
        const ok = [...T.values()].filter(t => t.st === 'ok' || t.st === 'err').sort((a, b) => a.at - b.at); if (ok.length <= 70) return;
        ok.slice(0, ok.length - 70).forEach(t => { if (inView(t)) return; t.ids.forEach(id => { const b = B.get(id); if (!b) return; b.tiles.delete(t.k); if (!b.tiles.size && !(sel && sel.id === id)) { if (b.lay) gB.removeLayer(b.lay); B.delete(id); } }); t.ids.clear(); t.st = 'idle'; t.roads = null; });
      }
      function note(msg) { errors.push(msg); errors = errors.slice(-6); status(); }

      /* ---------- the status line, counts and table ---------- */
      /* the view the counts, the table and the CSV read: the map's, or while Street View hides the map, the last one it showed */
      let viewBounds = null; const curBounds = () => ((svMode || d3Mode || enMode) && viewBounds ? viewBounds : map.getBounds());
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
        detail(); street(t); if (enMode) { if (o && o.noSV) { enTarget = t; if (en) en.setCurrent(b.id); renderEnBar(); } else openEngine(t); } else if (d3Mode) { if (o && o.noSV) { d3Target = t; if (d3) d3.setCurrent(b.id); render3DBar(); } else open3D(t); } else if (svMode) { if (o && o.noSV) { svTarget = t; renderSvBar(); drawSoon(); } else showSV(t); } refreshSoon();
      }
      function pickPoint(la, lo) {
        const prev = sel && sel.type === 'b' ? B.get(sel.id) : null; sel = { type: 'pt', lat: la, lon: lo }; if (prev && prev.lay) prev.lay.setStyle(bStyle(prev));
        const t = { lat: la, lon: lo, street: '', b: null };
        detail(); street(t); if (enMode) openEngine(t); else if (d3Mode) open3D(t); else if (svMode) showSV(t); refreshSoon();
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
      /* ---------- the card's outlook: the next fifteen years for the building picked ---------- */
      const CAUSE_INK = { wind: '#1f86c9', hail: '#8448d6', wear: '#c9801f', leak: '#1a9c92', any: 'var(--ink)' };
      function outlookCard(b) {
        let O = null; try { O = outlookOf(b, {}); } catch (e) { O = null; } if (!O) return '';
        const A = O.all, Y = OUT_Y, W = 300, H = 118, L = 30, Rr = 6, T = 8, Bm = 18, x = t => L + (W - L - Rr) * t / Y, y = v => T + (H - T - Bm) * (1 - clamp(v, 0, 1));
        const wind = t => 1 - (1 - A.C.hur[t]) * (1 - A.C.ts[t]), series = [['any', 'A roofer needed', t => A.any[t]], ['wind', 'Wind', wind], ['wear', 'Heat, sun and age', t => A.C.wear[t]], ['leak', 'Leaks', t => A.C.leak[t]], ['hail', 'Hail', t => A.C.hail[t]]];
        const path = f => Array.from({ length: Y + 1 }, (_, t) => `${t ? 'L' : 'M'}${x(t).toFixed(1)} ${y(f(t)).toFixed(1)}`).join('');
        const svg = `<svg class="sc-outch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chance of each kind of roof damage by year, ${THIS_YEAR} to ${THIS_YEAR + Y}">${[0, 0.25, 0.5, 0.75, 1].map(v => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="var(--ink-3)">${Math.round(v * 100)}%</text>`).join('')}${[0, 5, 10, 15].map(t => `<text x="${x(t)}" y="${H - 5}" text-anchor="${t === 0 ? 'start' : t === Y ? 'end' : 'middle'}" font-size="9" fill="var(--ink-3)">${THIS_YEAR + t}</text>`).join('')}${series.map(([k, , f]) => `<path d="${path(f)}" fill="none" stroke="${CAUSE_INK[k]}" stroke-width="${k === 'any' ? 2.2 : 1.6}" stroke-linejoin="round"/>`).join('')}</svg>`;
        const key = `<div class="sc-outkey">${series.map(([k, l, f]) => `<span><i style="background:${CAUSE_INK[k]}"></i>${esc(l)} <b>${pc1(f(Y))}</b></span>`).join('')}</div>`;
        const rk = causeRank(A, Y), top = rk[0], T0 = RTYPE[O.types[0][0]], rows = O.byType.filter(r => r.w >= 0.03).map(r => { const k2 = causeRank(r.o, Y)[0]; return `<tr><td>${esc(r.l)}<span class="sc-outwhy">mostly ${esc(causeShort(k2))}</span></td><td class="num">${pct(r.w)}</td><td class="num">${pc1(r.o.any[5])}</td><td class="num">${pc1(r.o.any[10])}</td><td class="num">${pc1(r.o.any[Y])}</td><td class="num">${pc1(r.o.rep[Y])}</td></tr>`; }).join('');
        const low1 = t => t.charAt(0).toLowerCase() + t.slice(1), kinds = O.byType.filter(r => r.w >= 0.03).map(r => { const T = RTYPE[r.k], al = T.algae * r.o.alg[Y], ru = T.rust * r.o.rust[Y];
          return `<p class="sc-outkind"><b>${esc(r.l)}</b> · ${pct(r.w)} likely</p><ul class="sc-outdo">${causeRank(r.o, Y).map(k => `<li><b>${esc(k.l)} ${pc1(k.p)}</b> ${esc(k.c === 'wind' ? T.does.hur + (r.o.C.ts[Y] >= 0.03 ? '. In a thunderstorm or tornado: ' + low1(T.does.ts) : '') : T.does[k.c] || '')}.</li>`).join('')}${al > 0.1 && T.does.algae ? `<li><b>Algae ${pc1(al)}</b> ${esc(T.does.algae)}.</li>` : ''}${ru > 0.05 && T.does.rust ? `<li><b>Rust ${pc1(ru)}</b> ${esc(T.does.rust)}.</li>` : ''}</ul>`; }).join('');
        const rustT = O.byType.find(r => RTYPE[r.k].rust > 0), rustV = rustT ? RTYPE[rustT.k].rust * rustT.o.rust[Y] : 0, hz = O.hz, recL = { mid: 'Both', recent: `Since ${OC.recFrom}`, long: `Since ${OC.longFrom}` };
        return `<div class="sc-sec sc-out"><p class="sc-k">The next 15 years ${G('D')}</p>
            <div class="sc-sys">By ${THIS_YEAR + Y}: a roofer needed ${pc1(A.any[Y])}, the roof replaced ${pc1(A.rep[Y])}</div>
            <div class="sc-sub">The chance, year by year, that this roof takes each kind of damage at least once: from the storms, hail and wind on record for this ZIP and those round it, the roof's likely covering and its age today. Odds from records and stated judgments, not a prediction of any one storm.</div>
            ${svg}${key}
            <div class="sc-sub"><b>Most likely: ${esc(causeText(top))}</b> (${pc1(top.p)}; replaced ${pc1(top.rep)}, repaired ${pc1(top.fix)}). ${esc(T0.does[top.sub] || '')}.</div>
            ${rows ? `<table class="sc-outt"><thead><tr><th>If the roof is</th><th class="num">Odds</th><th class="num">${THIS_YEAR + 5}</th><th class="num">${THIS_YEAR + 10}</th><th class="num">${THIS_YEAR + Y}</th><th class="num">New<br>roof</th></tr></thead><tbody>${rows}</tbody></table><div class="sc-sub">Odds: how likely the roof is of that kind. The three years: a roofer needed by then. New roof: replaced by ${THIS_YEAR + Y}.</div>` : ''}
            ${kinds ? `<details class="sc-outmore"><summary>What each kind of damage does, by kind of roof</summary>${kinds}<p class="sc-sub">Each figure is the chance of that damage at least once by ${THIS_YEAR + Y} if the roof is of that kind; algae and rust are the chance they show on the roof then in place.</p></details>` : ''}
            <div class="sc-sub">Hurricanes and tropical storms here replace ${D(hz.long.rep * 100, 1)}% of roofs a year at the pace of the years since ${OC.longFrom} and ${D(hz.recent.rep * 100, 1)}% at the pace since ${OC.recFrom} (FEMA's verified damage where it has it, modeled wind elsewhere)${hz.top && hz.top.d >= 0.005 ? `; the costliest year here since ${OC.recFrom} was ${hz.top.y} (${esc(stormName(SIDS[hz.top.si]).replace(/ \(\d{4}\)$/, ''))}), when the record has about ${pc1(hz.top.d)} of this ZIP's roofs replaced` : ''}. Hail of an inch or more falls within 25 miles on ${D(hz.hailDays[0], 1)} days a year, wind of 58 mph or more on ${D(hz.days.wd50, 1)}.${isN(O.heat) && Math.abs(O.heat - 1) >= 0.03 ? ` Heat ages this roof ${D(O.heat, 2)} times as fast as the average roof of its kind here (the Scout Engine's reading of its planes and colour), which ${O.heat > 1 ? 'shortens' : 'stretches'} its life in this outlook.` : ''}${O.slow.algae[Y] > 0.25 ? ` Algae streaks on the roof then in place, in ${THIS_YEAR + Y}: ${pc1(O.slow.algae[Y])}.` : ''}${rustT && rustV > 0.1 ? ` Rust, if the roof is ${esc(rustT.l.toLowerCase())}: ${pc1(rustV)} by then (${D(O.km, 0)} km from the Gulf's open shore; lakes, bays and canals are not counted).` : ''}</div>
            <div class="sc-outctl"><span class="mini">Storm record</span><span class="seg" id="scOutRec" role="group" aria-label="Storm record used">${['mid', 'recent', 'long'].map(k => `<button type="button" data-v="${k}" aria-pressed="${(CFG.outRec || 'mid') === k}" title="${k === 'mid' ? 'The mean of the two records' : k === 'recent' ? 'The years the atlas resolves storm by storm at each ZIP, 1990 on: harder on Louisiana than the forty years before' : 'The 76 years since 1950: the same storms, with the hurricane years before 1990 counted from the atlas and given the mean cost of a year of their strength'}">${recL[k]}</button>`).join('')}</span><button type="button" class="btn sm sec" id="scOutEn" title="The same reading drawn on the roof in the Scout Engine: move the year and watch where each kind of damage is likeliest">See it on the roof ↗</button></div></div>`;
      }
      /* the outlook's own buttons; and that section drawn again alone (another storm record, or the engine has read the
         roof's heat), so the rest of the card, and a note being typed in it, stay as they are */
      function outlookWire(b) {
        const dt = $('#scDetail', root); if (!dt || !b) return;
        $$('#scOutRec button', dt).forEach(x => x.onclick = () => { CFG.outRec = x.dataset.v; saveCfg(); outlookRedraw(b); if (en) en.lensRefresh(); });
        const oe = $('#scOutEn', dt); if (oe) oe.onclick = async () => { mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); await openEngine({ lat: b.lat, lon: b.lon, street: b.street, b }); if (en && enMode) { en.setGraphics({ lens: 'time' }); en.setHeight('orbit'); renderEnBar(); } };
      }
      function outlookRedraw(b) { const dt = $('#scDetail', root), e = dt && $('.sc-out', dt); if (!e || !b) return; const h = outlookCard(b); if (!h) { e.outerHTML = ''; return; } e.outerHTML = h; outlookWire(b); }
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
          ${hasRoof ? outlookCard(b) : ''}
          <div class="sc-sec"><p class="sc-k">Evidence</p><ul class="sc-ev"><li>${ybTxt}</li><li>${permTxt}</li><li>${evTxt}</li>${resetTxt ? `<li>${resetTxt}</li>` : ''}${ctx ? `<li>${ctx}</li>` : ''}<li><b>${esc((PROF[b.cls] || PROF.unk).l)}</b>: FEMA USA Structures (${esc(b.occ || 'unclassified')}${b.prim && b.prim !== b.occ ? ', ' + esc(b.prim) : ''})${b.acc ? '; read as an accessory building because a larger structure shares its address' : ''} ${G('C')}</li></ul></div>
          <div class="sc-sec sc-check"><p class="sc-k">Field check: what you saw on the roof or from the street</p>
            <div class="seg" id="scCkS" role="group" aria-label="Your status">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely'], ['', 'Model']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${(ck.s || '') === v}">${l}</button>`).join('')}</div>
            <div class="sc-cues">${CUES.map(([k, l]) => `<label class="chk"><input type="checkbox" data-cue="${k}"${(ck.cues || []).includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>
            <input type="text" id="scCkN" maxlength="240" placeholder="A note (kept in this browser)" value="${esc(ck.note || '')}">
            ${ck.at ? `<p class="sc-note">Checked ${esc(new Date(ck.at).toLocaleString())}</p>` : ''}</div>
          <div class="sc-acts"><button class="btn sm" id="scSv1">Street view</button><button class="btn sm sec" id="scSvG">Google photos</button><button class="btn sm sec" id="scCopy">Copy address</button><button class="btn sm sec" data-go-lines="1">Service Lines ↗</button><button class="btn sm sec" id="scDesk1">Campaign Desk ↗</button></div>`;
        $('#scSv1', dt).onclick = () => { open3D({ lat: b.lat, lon: b.lon, street: b.street, b }); mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        outlookWire(b);
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
        const was = viewMode; viewMode = m; svMode = m === 'sv'; d3Mode = m === '3d'; enMode = m === 'eng';
        if (!svMode) { svf.src = 'about:blank'; GM.live = false; GM.hov = null; }   /* unload the plain player before its frame is hidden: at 0 by 0 it logs errors of its own */
        if (!d3Mode && d3) d3.stop();
        if (!enMode && en) { en.stop(); enPlay(false); }
        $$('#scMode button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === m)));
        host.hidden = m !== 'map'; svw.hidden = !svMode; d3w.hidden = !d3Mode; enw.hidden = !enMode; hideTip();
        $('#scModeNote', root).textContent = svMode ? 'Google\'s photographs of the street. The satellite map and the 3D view are hidden while they show: Google\'s terms keep its Street View off any screen with another map.' : d3Mode ? 'The neighborhood built from open data, every building glowing in its colour. Walk the streets and alleys, or rise to drone and bird height for the roofs.' : enMode ? EN_NOTE : 'Pick a building, then Street view to stand in the street in front of it (or double click the building).';
        if (m === 'map') { if (svFull) full(false); const t = was === '3d' ? d3Target : was === 'eng' ? enTarget : svTarget; setTimeout(() => { map.invalidateSize({ pan: true }); if (t) map.panTo([t.lat, t.lon]); }, 0); }
        if (d3Mode && d3) d3.start();
        if (enMode && en) en.start();
      }
      /* Full window: the map card covers the page, so everything outside it is made inert (focus cannot reach a covered
         control) while the toast and the tooltip stay live; and leaving the tab by any route (a rail tab, a typed hash, a
         hand off) ends it, so the next module is never left unscrollable */
      const inertOut = on => {
        if (!on) { document.querySelectorAll('[data-sc-inert]').forEach(e => { e.inert = false; e.removeAttribute('data-sc-inert'); }); return; }
        for (let n = mapCard; n && n.parentElement && n !== document.body; n = n.parentElement)
          [...n.parentElement.children].forEach(c => { if (c === n || c.inert || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(c.tagName) || c.classList.contains('toast') || c.id === 'tip' || c.hasAttribute('aria-live')) return; c.inert = true; c.setAttribute('data-sc-inert', ''); });
      };
      function full(on) { svFull = !!on; mapCard.classList.toggle('sc-full', svFull); document.documentElement.classList.toggle('sc-noscroll', svFull); inertOut(svFull); if (svMode) { renderSvBar(); drawSoon(); } if (d3Mode) render3DBar(); if (enMode) renderEnBar(); }
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
        else if (viewMode === 'eng' && en) { const s2 = en.state(); t = { lat: s2.lat, lon: s2.lon, street: '', b: null }; }
        else if (viewMode === 'sv' && svTarget) t = svTarget;
        else if (sel && sel.type === 'pt') t = { lat: sel.lat, lon: sel.lon, street: '', b: null };
        else { const c = map.getCenter(); if (map.getZoom() < 14) toast('Showing the street nearest the map\'s centre. Pick a building to aim at it.'); t = { lat: c.lat, lon: c.lng, street: '', b: null }; }
        if (v === '3d') open3D(t); else if (v === 'eng') openEngine(t); else showSV(t);
      });
      document.addEventListener('keydown', e => { if (e.key !== 'Escape' || viewMode === 'map' || root.hidden) return; if (svFull) full(false); else setMode('map'); });

      /* ---------- the 3D street view: the neighborhood built from open data, no key, the glows exact ---------- */
      /* scout3d.js builds it (FEMA buildings raised to their heights, Esri imagery on the roofs and the ground, OpenStreetMap
         streets and alleys); this part feeds it the module's buildings and readings and hears what the person does in it. It
         draws Esri imagery, so it is a non-Google map: it takes the card's place as the satellite map does, and never shares
         the screen with Google's photos. */
      const d3w = $('#sc3dW', root), d3Bar = $('#sc3dBar', root), d3Host = $('#sc3D', root);
      var d3 = null, d3Mode = false, d3Target = null, d3St = null, viewMode = 'map';
      var en = null, enMode = false, enTarget = null, enSt = null;
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
            <button type="button" class="ibtn" data-a="engine" title="The same neighborhood in the Scout Engine: a physical sky, bounced light, reflections, traffic, and the roof views (heat, weather wear, the next 15 years)">Scout Engine</button>
            <button type="button" class="ibtn" data-a="export" title="Download this area as a 3D model (glTF .glb) for Unreal Engine 5, Blender or any 3D tool: every building with its reading and its glow, the streets and the trees (Esri's imagery stays out)">⇩ 3D model for Unreal</button>
            <button type="button" class="ibtn" data-a="full">${svFull ? '⤡ Exit full window' : '⤢ Full window'}</button>
            <button type="button" class="ibtn" data-a="photos" title="Google's photographs of this street, in the card's place">Google photos</button>
            <button type="button" class="btn sm" data-a="map">Back to satellite</button>
          </div>
          <div class="sc-svwhere" id="sc3dWhere">${where3D(st)}</div>${photoForm()}`;
        $$('[data-a]', d3Bar).forEach(x => x.onclick = () => { const a = x.dataset.a;
          if (a === 'map') setMode('map'); else if (a === 'full') full(!svFull); else if (a === 'face' && d3 && b) d3.face(b); else if (a === 'prev' || a === 'next') step(a === 'next' ? 1 : -1);
          else if (a === 'export' && d3 && d3.exportGLB) { x.disabled = true; x.textContent = 'Building the model…'; const s2 = d3.state(); d3.exportGLB().then(blob => saveFile(`rooftop-scout-3d-${slugA(s2.road)}-${new Date().toISOString().slice(0, 10)}.glb`, blob)).catch(e => toast('The 3D model did not build: ' + (e && e.message || e))).finally(() => render3DBar()); }
          else if (a === 'engine') { const s2 = d3 ? d3.state() : null; openEngine(b ? { lat: b.lat, lon: b.lon, street: b.street, b } : s2 ? { lat: s2.lat, lon: s2.lon, street: '', b: null } : t); }
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

      /* ---------- the Scout Engine: the same neighborhood drawn by the engine written for this page ---------- */
      /* engine.js (window.__SCOUT_ENGINE__) is a renderer of its own on WebGL2: a deferred, physically based pipeline with
         a physical sky, cascaded sun shadows, bounced light and reflections traced on screen, temporal anti-aliasing, and
         around it physics, particles, an editor. window.__SCOUT_E3D__ builds the neighborhood with it from the same data the
         three.js view reads (env3d), streamed cell by cell round the camera. Like that view it draws Esri imagery, so it takes
         the card's place and never shares the screen with Google's photographs. What it adds to the record is said in the
         view: window grids, cars, signals, sidewalks and rooftop equipment are generated, not observed. Its roof views are
         this module's own readings laid on the roofs (LENS, above): the heat a roof takes in the sun, the wear the weather
         has put on it, and the damage it is most likely to take over the next fifteen years. */
      const enw = $('#scEnW', root), enBar = $('#scEnBar', root), enHost = $('#scEn', root);
      const EN_NOTE = 'The neighborhood in the Scout Engine: every building the dashboard holds on its FEMA footprint at its recorded height (a usual one for its kind where none is on file) under a physical sky, the city going on to the skyline. Roof View reads every roof six ways: what covers it, which shingle it is, how hot it runs, how worn it is, what the storm on the storm scale would do to it, and the damage most likely over the next 15 years. The storm scale runs from light rain to a Category 5 hurricane. Walk, circle a building or fly an Alta X; past light rain the Alta X stays on the ground, and the flying saucer and the Tic Tac fly instead and warp to any address or coordinates in Louisiana. Window grids, cars, signals, sidewalks, rooftop equipment, the weather and the two craft are generated, not observed; the roof views are a model, not an inspection.';
      /* a roof's heat, once the engine has read its planes, goes into the card's outlook too */
      const heatSoon = debounce(() => { if (sel && sel.type === 'b') outlookRedraw(B.get(sel.id)); }, 700);
      LENS.onHeat = b => { if (sel && sel.type === 'b' && sel.id === b.id) heatSoon(); };
      const envEn = Object.assign({}, env3d, {
        onPick: b => { hideTip(); pick(b.id, { noSV: true }); }, onFront: b => { hideTip(); pick(b.id); },
        onMove: st => { enSt = st; whereEnSoon(); }, onNote: t => { const n = $('#scEnNote', root); if (n) n.textContent = t || ''; }, onGraphics: () => renderEnBar(),
        label: b => `${STS[b.status]} · ${b.sc.score}`,
        /* gravity warp: once the craft is there the building at the place is picked as its tiles arrive; G in the view asks where to */
        onWarp: stage => { if (stage === 'there') setTimeout(tryPending, 700); if (stage === 'done') { warping = false; clearTimeout(warpT); renderEnBar(); } },
        onWarpAsk: () => { const i = $('#scWarp', enBar); if (i) { i.focus(); i.select(); } },
        /* every building the dashboard holds, whatever its filters show: the world is the city, the filters are a reading of it */
        buildings: () => { const out = []; B.forEach(b => { if (b.sc) out.push(b); }); return out; },
        color: b => (shown(b) ? COL[b.status] : '#9aa3a8'), shown: b => shown(b),
        /* the roof views: what each roof reads, plane by plane (LENS) */
        lens: LENS,
        /* the wider city, a square of the map at a time. Two public records are merged, because neither is the satellite
           picture's age: FEMA's USA Structures (in California traced from lidar of 2010 to 2012 in the metros and from imagery of
           2014 to 2024 elsewhere; it
           has heights and uses) and OpenStreetMap's buildings as they stand today (Esri's hosted copy). FEMA's footprints are
           the base. An OpenStreetMap building that stands where FEMA has none is added (built since, or missed). One that
           is newer than FEMA's picture and much larger than the FEMA footprints under it replaces them (a block cleared
           and rebuilt). Where FEMA has no height, OpenStreetMap's height or floor count is used. minH asks FEMA alone for
           the tall ones, for the skyline. */
        context: async (box, o) => {
          const ask = async (url, extra, bx, depth) => { const j = await getJSON(url + '?' + qs(Object.assign({ geometry: env(bx), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outSR: 4326, geometryPrecision: 5, maxAllowableOffset: 0.000008, f: 'geojson' }, extra)), { timeout: 45000 });
            if (j.properties && j.properties.exceededTransferLimit && depth < 2) { const mx = (bx.w + bx.e) / 2, my = (bx.s + bx.n) / 2; return (await Promise.all([{ w: bx.w, e: mx, s: bx.s, n: my }, { w: mx, e: bx.e, s: bx.s, n: my }, { w: bx.w, e: mx, s: my, n: bx.n }, { w: mx, e: bx.e, s: my, n: bx.n }].map(x => ask(url, extra, x, depth + 1)))).flat(); }
            return j.features || []; };
          const ringOf = g => (!g ? null : g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null);
          const shape = rr => { let a = 0, cx = 0, cy = 0; const k = Math.cos(rad(rr[0][0])); for (let i = 0, n = rr.length; i < n; i++) { const p = rr[i], q = rr[(i + 1) % n], f = (p[1] * q[0] - q[1] * p[0]) * k; a += f; cx += (p[1] + q[1]) * f; cy += (p[0] + q[0]) * f; } a /= 2; return Math.abs(a) < 1e-14 ? null : { la: cy / (6 * a), lo: cx / (6 * a), m2: Math.abs(a) * 111320 * 110900 }; };
          const inRing = (la, lo, rr) => { let c = false; for (let i = 0, j = rr.length - 1; i < rr.length; j = i++) { const p = rr[i], q = rr[j]; if ((p[0] > la) !== (q[0] > la) && lo < (q[1] - p[1]) * (la - p[0]) / (q[0] - p[0]) + p[1]) c = !c; } return c; };
          const seen = new Set(), out = [], tall = !!(o && o.minH);
          const fema = await ask(EP.bldg, { where: tall ? 'HEIGHT > ' + (+o.minH) : '1=1', outFields: tall ? 'OCC_CLS,PRIM_OCC,HEIGHT,SQFEET,LATITUDE,LONGITUDE' : 'OCC_CLS,PRIM_OCC,HEIGHT,SQFEET,LATITUDE,LONGITUDE,IMAGE_DATE' }, box, 0);
          fema.forEach(f => { const p = f.properties || {}, ring = ringOf(f.geometry); if (!ring || ring.length < 4) return;
            const rr = ring.map(([x, y]) => [y, x]), bb = bboxOf([rr]); let la = +p.LATITUDE, lo = +p.LONGITUDE; if (!isN(la) || !isN(lo) || !inBox(la, lo, [bb[0] - 0.001, bb[1] - 0.001, bb[2] + 0.001, bb[3] + 0.001])) { la = (bb[0] + bb[2]) / 2; lo = (bb[1] + bb[3]) / 2; }
            const id = 'x' + la.toFixed(6) + lo.toFixed(6); if (seen.has(id)) return; seen.add(id); const cls = classify(p), sh = shape(rr);
            out.push({ id, la, lo, ring: rr, bb, cls, h: hOf({ h: +p.HEIGHT || 0, cls }), hKnown: +p.HEIGHT > 2.2, m2: sh ? sh.m2 : 0, yr: p.IMAGE_DATE ? new Date(+p.IMAGE_DATE).getUTCFullYear() : 0, src: 'fema' }); });
          if (tall) return out;
          let osm = []; try { osm = await ask(EP.osmBldg, { where: '1=1', outFields: 'osm_id,osm_timestamp,building,height,building_levels,levels,amenity,shop,office,tourism' }, box, 0); } catch (e) { osm = []; out.osmFailed = true; }
          /* FEMA's footprints on a coarse grid, so each OpenStreetMap building looks only at its neighbours */
          const G = new Map(), cell = 0.0006; out.forEach(f => { for (let a = Math.floor(f.bb[0] / cell); a <= Math.floor(f.bb[2] / cell); a++) for (let b2 = Math.floor(f.bb[1] / cell); b2 <= Math.floor(f.bb[3] / cell); b2++) { const k = a + ':' + b2; let l = G.get(k); if (!l) G.set(k, l = []); l.push(f); } });
          const osmCls = p => { const b2 = String(p.building || '').toLowerCase(); if (p.tourism === 'hotel' || b2 === 'hotel') return 'hotel'; if (/^(apartments|residential|dormitory)$/.test(b2)) return 'mf'; if (/^(house|detached|semidetached_house|terrace|bungalow|cabin)$/.test(b2)) return 'sf'; if (/^(garage|garages|carport)$/.test(b2)) return 'garage'; if (/^(shed|hut|roof)$/.test(b2)) return 'shed';
            if (/^(warehouse|industrial|hangar)$/.test(b2)) return 'whse'; if (/^(parking)$/.test(b2) || p.amenity === 'parking') return 'parking'; if (/^(retail|supermarket|kiosk)$/.test(b2) || p.shop) return 'retail'; return 'unk'; };
          const osmH = p => { const m = /^\s*([0-9.]+)\s*(m|ft|')?/i.exec(String(p.height == null ? '' : p.height)); if (m && +m[1] > 0) return +m[1] * (m[2] && m[2] !== 'm' ? 0.3048 : 1); const lv = parseFloat(p.building_levels != null ? p.building_levels : p.levels); return lv > 0 && lv < 200 ? lv * 3.5 + 1 : 0; };
          const dropped = new Set(); let added = 0, replaced = 0, heights = 0;
          osm.forEach(f => { const p = f.properties || {}, ring = ringOf(f.geometry); if (!ring || ring.length < 4) return; const b2 = String(p.building || '').toLowerCase(); if (!b2 || b2 === 'no' || b2 === 'construction' || b2 === 'proposed' || b2 === 'ruins') return;
            const rr = ring.map(([x, y]) => [y, x]), sh = shape(rr); if (!sh || sh.m2 < 12) return; const bb = bboxOf([rr]), near = new Set(); for (let a = Math.floor(bb[0] / cell); a <= Math.floor(bb[2] / cell); a++) for (let c2 = Math.floor(bb[1] / cell); c2 <= Math.floor(bb[3] / cell); c2++) (G.get(a + ':' + c2) || []).forEach(x => near.add(x));
            const under = [...near].filter(x => !dropped.has(x) && (inRing(x.la, x.lo, rr) || inRing(sh.la, sh.lo, x.ring))), oh = osmH(p), ts = p.osm_timestamp, yr = typeof ts === 'number' ? new Date(ts).getUTCFullYear() : parseInt(String(ts || '').slice(-4), 10) || parseInt(String(ts || '').slice(0, 4), 10) || 0;
            if (under.length) { const fa = under.reduce((t, x) => t + x.m2, 0), newer = under.every(x => x.yr && yr >= x.yr + 1);
              if (newer && sh.m2 > 1.5 * fa && sh.m2 > 300) { under.forEach(x => dropped.add(x)); replaced++; }
              else { if (oh > 2.2) under.forEach(x => { if (!x.hKnown && under.length === 1) { x.h = oh; x.hKnown = true; heights++; } }); return; } }
            const cls = osmCls(p), id = 'o' + (p.osm_id != null ? p.osm_id : sh.la.toFixed(6) + sh.lo.toFixed(6)); if (seen.has(id)) return; seen.add(id); added++;
            out.push({ id, la: sh.la, lo: sh.lo, ring: rr, bb, cls, h: oh > 2.2 ? oh : hOf({ h: 0, cls }), hKnown: oh > 2.2, m2: sh.m2, yr, src: 'osm' }); });
          const list = out.filter(f => !dropped.has(f)); list.dropped = [...dropped].map(f => [f.la, f.lo]); list.stats = { fema: fema.length, osm: osm.length, added, replaced, heights, osmFailed: !!out.osmFailed }; return list; },
      });
      const refreshEn = debounce(() => { if (en && enMode) en.refresh(); }, 350);
      async function openEngine(target) {
        if (!target) return;
        if (!en && !window.__SCOUT_E3D__ && document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        if (!en) { en = window.__SCOUT_E3D__ ? window.__SCOUT_E3D__(enHost, envEn) : null; if (!en) { toast('This browser cannot run the Scout Engine (it needs WebGL2 with floating point targets). The 3D street view and Google photos still work.'); return; } }
        enTarget = target; if (viewMode === 'map') { viewBounds = map.getBounds(); svList = svListNow(); }
        if (!enMode) setMode('eng');
        renderEnBar();
        let v; try { v = await aim(target); } catch (e) { v = { lat: target.lat, lon: target.lon, heading: 0 }; }
        if (!enMode || enTarget !== target) return;
        await en.open(v.lat, v.lon, target.b ? null : v.heading, { cur: target.b ? target.b.id : null, face: target.b || null });
        renderEnBar(); try { en.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ }
      }
      function whereEn(st) {
        if (!st) return ''; const g = en ? en.graphics() : null;
        const kind = { major: 'main road', alley: 'alley', service: 'service drive' }[st.roadKind] || '';
        const on = st.mode === 'street' ? (st.road ? `On ${esc(st.road)}${kind ? ' (' + kind + ')' : ''}` : kind ? 'On a ' + kind : 'At street level') : st.mode === 'walk' ? 'On foot (walls stop you; Space jumps, Shift runs)' : st.mode === 'drone' ? 'At drone height, 38 m up' : st.mode === 'bird' ? 'At bird height, 120 m up' : st.mode === 'metro' ? 'High over the city, 1,400 m up' : st.mode === 'alta' ? `Flying the Alta X${st.alta ? ' (' + esc(st.alta.mode.toLowerCase()) + ', ' + N(Math.round(st.alta.alt)) + ' m up, batteries ' + N(Math.round(st.alta.battery * 100)) + '%)' : ''}` : st.mode === 'saucer' || st.mode === 'tictac' ? `In ${st.mode === 'saucer' ? 'the flying saucer' : 'the Tic Tac'}${st.uap ? ' (' + esc(st.uap.mode.toLowerCase()) + ', ' + N(Math.round(st.uap.alt)) + ' m up, ' + N(Math.round(st.uap.speed * 2.237)) + ' mph)' : ''}` : 'Circling';
        const keys = st.mode === 'saucer' || st.mode === 'tictac' ? 'Drag to look round it; <b>W</b> <b>S</b> <b>A</b> <b>D</b> fly (faster the higher it is, and faster still on <b>Shift</b>), <b>←</b> <b>→</b> turn, <b>↑</b> <b>↓</b> climb and descend, <b>C</b> its camera, <b>X</b> the roof views, <b>G</b> gravity warp; click the ground to go there, double click a roof to hang over it.' : st.mode === 'alta' ? 'Drag to look round it; <b>W</b> <b>S</b> <b>A</b> <b>D</b> fly, <b>←</b> <b>→</b> turn, <b>↑</b> <b>↓</b> climb and descend, <b>C</b> its camera, <b>X</b> the roof views, <b>H</b> home, <b>L</b> land; click the ground to send it there, double click a building to hover off its face.' : 'Drag to look; <b>W</b> <b>S</b> move, <b>A</b> <b>D</b> turn, <b>Q</b> <b>E</b> rise and come down, <b>X</b> the roof views, <b>[</b> <b>]</b> the year; click the ground to go there, a building to read it.';
        return `${on}, looking ${compass(st.yaw)}${g && g.storm ? ' · <b>' + esc(g.stormInfo.name) + '</b>' + (g.surgeNote ? ': ' + esc(g.surgeNote) : '') : ''} · <b>${N(st.built)}</b> buildings${st.queued ? ', ' + N(st.queued) + ' cells still building' : ''}${st.roads ? '' : ' · the streets are still loading'}${g && g.lens !== 'off' ? ` · ${N(g.lensN)} roofs read in the ${esc(LENS.names[g.lens] || g.lens).toLowerCase()} view${g.lensPending ? ', ' + N(g.lensPending) + ' to go' : ''}` : ''}${g ? ` · <span class="sc-enfps">${N(g.fps)} frames a second, ${N(g.tris)} triangles</span>` : ''}${g && g.broken ? ` · <b>the engine cannot draw with this graphics driver: ${esc(g.broken)}</b>` : ''}${g && g.refused && g.refused.length ? ` · this graphics driver refused ${esc(g.refused.join(', '))}; switched off` : ''}${g && g.wide && g.wideN ? ` · the wider city: ${N(g.wideN)} buildings${g.wideOsm ? ' (' + N(g.wideOsm) + ' of them newer than FEMA\'s file, from OpenStreetMap' + (g.wideReplaced ? '; ' + N(g.wideReplaced) + ' cleared footprints left out' : '') + ')' : ''}${g.widePending ? ', more coming' : ''}${g.skyline ? ', ' + N(g.skyline) + ' towers to the horizon' : ''}` : ''}. ${keys}`;
      }
      const whereEnSoon = debounce(() => { const w = $('#scEnWhere', root); const stNow = (en && en.state()) || enSt; if (w && enMode) w.innerHTML = whereEn(stNow); if (en && stNow) { $$('#scEnBar [data-h]', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.h === stNow.mode))); $$('#scEnPad .sc-enalt', root).forEach(x => { x.hidden = !(stNow.mode === 'alta' || stNow.mode === 'saucer' || stNow.mode === 'tictac'); }); } }, 120);
      let enGfxOpen = false, enPlayT = 0, warping = false, warpT = 0, warpQ = '', enSound = false;
      /* the storm scale's steps, short, for under its slider; and what the step in force is, in a line */
      const STORM_T = ['Dry', 'Light', 'Heavy', 'T-storm', 'Tropical', 'Cat 1', 'Cat 2', 'Cat 3', 'Cat 4', 'Cat 5'];
      const stormText = g => { const x = g && g.stormInfo; if (!x || !x.level) return '<b>No storm</b> · the weather is the Scene menu\'s. Slide right for rain, wind and hurricanes.';
        return `<b>${esc(x.name)}</b> · wind ${x.range ? (x.range[1] ? x.range[0] + ' to ' + x.range[1] : x.range[0] + ' and up') : 'about ' + x.mph} mph${x.level >= 3 ? ', gusts near ' + x.gust : ''} · rain drawn at ${x.rain} mm an hour${x.level >= 7 ? (g.surge > 0.05 ? ` · surge drawn ${D(g.surge * 3.281, 0)} ft deep here (a picture, not a flood map)` : ' · no surge drawn here (the picture\'s edge, not the water\'s)') : x.level >= 5 ? ' · no flood is drawn below Category 3, though such storms bring surge too' : ''}`; };
      /* gravity warp: places it will go. Louisiana only: the state's outline is the atlas's own */
      const WARP_TO = [['New Orleans', 29.9511, -90.0715], ['Baton Rouge', 30.4515, -91.1871], ['Shreveport', 32.5252, -93.7502], ['Lafayette', 30.2241, -92.0198], ['Lake Charles', 30.2266, -93.2174], ['Houma', 29.5958, -90.7195], ['Monroe', 32.5093, -92.1193], ['Alexandria', 31.3113, -92.4451], ['Slidell', 30.2752, -89.7812], ['Hammond', 30.5044, -90.4612], ['Grand Isle', 29.2366, -89.9873], ['Cameron', 29.7977, -93.3252]];
      const LA_RINGS = (() => { try { return pathRings(G0.outline); } catch (e) { return []; } })();
      const inLouisiana = (la, lo) => isN(la) && isN(lo) && la > 28.8 && la < 33.1 && lo > -94.1 && lo < -88.7 && (!LA_RINGS.length || inRings(la, lo, LA_RINGS));
      async function warpGo(q, city) {
        if (!en || warping || !q) return; const st0 = en.state(); if (!st0 || !st0.uap) { toast('Take out the flying saucer or the Tic Tac first'); return; }
        let la, lo, label; const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NnSs])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([WwEe])?\s*$/.exec(q);
        if (city) { la = city[1]; lo = city[2]; label = city[0]; }
        else if (m) { la = +m[1]; lo = +m[3]; const ns = (m[2] || '').toUpperCase(), ew = (m[4] || '').toUpperCase(); if (!ns && !ew && Math.abs(la) > 60 && Math.abs(lo) < 60) { const t2 = la; la = lo; lo = t2; } if (ns === 'S') la = -Math.abs(la); if (ew === 'W') lo = -Math.abs(lo); else if (ew === 'E') lo = Math.abs(lo); else if (lo > 0) lo = -lo; label = la.toFixed(4) + ', ' + lo.toFixed(4); }
        else { if (VIEWER) { toast('Address search needs the network'); return; }
          try { const j = await getJSON(EP.geocode + '?' + qs({ f: 'json', singleLine: q, maxLocations: 1, outFields: 'Match_addr,Addr_type', searchExtent: '-94.1,28.9,-88.8,33.1', location: '-91.6,30.9', countryCode: 'USA' }), { timeout: 15000 });
            const c = (j.candidates || [])[0]; if (!c || c.score < 75 || !c.location) { toast('No match in Louisiana for that address'); return; } la = c.location.y; lo = c.location.x; label = c.address; }
          catch (err) { toast('Address search failed: ' + why(err)); return; } }
        if (!inLouisiana(la, lo)) { toast('Louisiana roofs only: that place is outside the state'); return; }
        if (!en || !en.uap.warp(la, lo, { cur: null })) { toast('It cannot warp just now'); return; }
        pendingPick = { lat: la, lon: lo }; warping = true; warpQ = ''; clearTimeout(warpT); warpT = setTimeout(() => { warping = false; renderEnBar(); }, 25000); toast('Gravity warp: ' + label); renderEnBar(); try { en.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ }
      }
      const enLon = () => (enSt && isN(enSt.lon) ? enSt.lon : enTarget && isN(enTarget.lon) ? enTarget.lon : -91.5);
      const hourOf = g => { const t = g && g.sunTime ? new Date(g.sunTime.getTime() + (enLon() / 15) * 3600e3) : null; return t ? t.getUTCHours() + t.getUTCMinutes() / 60 : 15; }, hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
      const yearText = y => (y ? `${THIS_YEAR + y} · in ${y} year${y === 1 ? '' : 's'}` : `${THIS_YEAR} · today`);
      function enMenu() {
        const g = en ? en.graphics() : null; if (!g) return ''; const ed = !!(en && en.editing);
        const seg = (name, cur, opts) => `<span class="seg" role="group" aria-label="${name}">${opts.map(([k, l]) => `<button type="button" data-eg="${name}:${k}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</span>`, h = hourOf(g);
        return `<details class="sc-gfx" id="scEnGfx"${enGfxOpen ? ' open' : ''}><summary class="ibtn" title="Quality, the day and hour, the weather, what shows">Scene: ${esc(g.label)}${g.q === 'auto' ? ' (auto)' : ''}</summary><div class="sc-gfxp">
            <div class="sc-gfxr"><span class="mini">Quality</span>${seg('q', g.q, [['auto', 'Auto'], ['ultra', 'Ultra'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']])}</div>
            <div class="sc-gfxr"><span class="mini">Day</span>${seg('day', g.day, [['today', 'Today'], ['summer', 'July 21'], ['fall', 'October 21'], ['winter', 'January 21'], ['spring', 'April 21']])}</div>
            <div class="sc-gfxr"><span class="mini">Sun</span>${seg('sun', g.sun, [['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['night', 'Night'], ['now', 'Now']])}</div>
            <div class="sc-gfxr"><span class="mini">Hour</span><span class="sc-enhour"><input type="range" id="scEnHour" min="0" max="24" step="0.25" value="${h.toFixed(2)}" aria-label="Hour of the day"><output id="scEnHourO">${hhmm(h)}</output></span></div>
            <div class="sc-gfxr"><span class="mini">Weather</span>${seg('weather', g.weather, [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['haze', 'Haze']])}</div>
            <div class="sc-gfxr"><span class="mini">Readings</span>${seg('glow', g.glow, [['outline', 'Outline'], ['glow', 'Glow'], ['off', 'Off']])}</div>
            <div class="sc-gfxr"><span class="mini">Streets</span>${seg('life', g.life ? 'on' : 'off', [['on', 'Traffic and furniture'], ['off', 'Bare']])}</div>
            <div class="sc-gfxr"><span class="mini">Trees</span>${seg('trees', g.trees ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}<span class="mini">Motion</span>${seg('live', g.live ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
            <div class="sc-gfxr"><span class="mini">Wider city</span>${seg('wide', g.wide ? 'on' : 'off', [['on', 'To the skyline'], ['off', 'Near only']])}<span class="mini">Equipment</span>${seg('roofKit', g.roofKit ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</div>
            <div class="sc-gfxr"><span class="mini">Engine tools</span><button type="button" class="ibtn" data-a="editor" aria-pressed="${ed}" title="The engine's editor: outliner, details, world settings, gizmos, buffer views, profiler">${ed ? 'Close editor' : 'Editor'}</button><button type="button" class="ibtn" data-a="crate" title="Throw a crate from the camera: it falls, tumbles and comes to rest on the ground or a roof">Throw a crate</button></div>
            <p class="mini">The weather here is the dry kinds: rain and storms are on the storm scale. A view at rest settles: each pixel averages the frames it has gathered, so edges, window bars and pavement hold still instead of shimmering, and sharpens over about a second after you stop. Ultra and High: sun shadows in four cascades, bounced light and ambient occlusion, reflections on glass and wet pavement, bloom. Medium drops the bounced light and reflections and draws fewer pixels, filling them in over time. Low is for machines without a graphics card. Auto picks one (${esc(g.tier)} here) and steps down if frames run long. The sun and moon stand where they do over this street on the chosen day at that hour; after dark the lamps, windows and headlights light the scene.${g.sunNote ? ' ' + esc(g.sunNote) : ''} The day and hour also set the Thermal roof view: the same sun heats the roofs. Buildings stand on their FEMA footprints at their recorded heights with Esri's imagery on their roofs; window grids and rooms, cars, signals, crosswalks and sidewalks are generated from the building's kind and the street map, and are not observed. The wider city is FEMA's footprints, with OpenStreetMap's where it has newer ones, for a few kilometres round as plain blocks with generated windows, and every building over 30 m out to about 18 km as the skyline. Rooftop units, condensers and cooling towers are the equipment a building of that kind, size and height most likely carries, placed by rule: a model, not a survey. Traffic obeys a car-following law, signals and stop signs, and no two cars may occupy the same ground. This machine draws with ${esc(g.gpu || 'an unnamed graphics device')}${g.refused && g.refused.length ? '; its driver refused ' + esc(g.refused.join(', ')) + ', which is switched off' : ''}.</p>
          </div></details>`;
      }
      function enPlay(on) {
        clearInterval(enPlayT); enPlayT = 0; if (!on || !en) return; let since = 0;
        /* a year stays a second and a half at least, and until the roofs in view show it (seven seconds at most, on a slow machine); Play stops when the view is not on screen */
        enPlayT = setInterval(() => { const g = en && enMode && enHost.clientWidth ? en.graphics() : null; if (!g || g.lens !== 'time') { enPlay(false); renderEnBar(); return; }
          since++; if (since < 3 || (g.lensPending > 0 && since < 14)) return; since = 0;
          const y = (g.year + 1) % (LENS.YEARS + 1); en.setGraphics({ year: y }); const r = $('#scEnYear', enBar), o = $('#scEnYearO', enBar); if (r) r.value = y; if (o) o.textContent = yearText(y); }, 500);
      }
      function renderEnBar() {
        const t = enTarget; if (!t) { enBar.innerHTML = ''; return; } const b = t.b ? (B.get(t.b.id) || t.b) : null, st = en ? en.state() : null, mode = st ? st.mode : 'street', ed = !!(en && en.editing), gNow = en ? en.graphics() : null, lens = gNow ? gNow.lens : 'off', lv = gNow ? gNow.storm || 0 : 0, fly = !gNow || !gNow.stormInfo || gNow.stormInfo.fly, isU = mode === 'saucer' || mode === 'tictac';
        if (b && !svList.includes(b.id)) { svList = svListNow(); if (!svList.includes(b.id)) svList.unshift(b.id); }
        const i = b ? svList.indexOf(b.id) : -1;
        enBar.innerHTML = `<div class="sc-svinfo">${b ? `<span class="sc-pill ${b.status}">${STL[b.status]}</span><b>${esc(b.addr ? title(b.addr) : 'Building, no address on file')}</b><span class="mini">${esc([(PROF[b.cls] || PROF.unk).l, b.roof.short, needLabel(b), 'score ' + b.sc.score].join(' · '))}</span>` : `<b>A point on the map</b><span class="mini">${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</span>`}</div>
          <div class="sc-enrow sc-roofview" role="group" aria-label="Roof View">
            <span class="sc-enlab" title="Read every roof in view. X in the view steps through them">Roof View</span>
            <span class="seg sc-lens">${LENS.list.map(([k, l, tip]) => `<button type="button" data-lens="${k}" aria-pressed="${lens === k}" title="${esc(tip)}">${k === 'off' ? '' : `<i class="sc-ldot l-${k}" aria-hidden="true"></i>`}${l}</button>`).join('')}</span>
            ${lens === 'time' ? `<span class="sc-enyear"><button type="button" class="ibtn" data-a="play" aria-pressed="${!!enPlayT}" title="Run the years from today to ${THIS_YEAR + LENS.YEARS}">${enPlayT ? '❚❚ Pause' : '▶ Play'}</button><input type="range" id="scEnYear" min="0" max="${LENS.YEARS}" step="1" value="${gNow.year}" aria-label="Years from today"><output id="scEnYearO">${yearText(gNow.year)}</output></span>` : ''}
            ${lens === 'thermal' && gNow ? `<span class="seg" role="group" aria-label="Day of the year">${[['today', 'Today'], ['summer', 'July 21'], ['winter', 'January 21']].map(([k, l]) => `<button type="button" data-eg="day:${k}" aria-pressed="${gNow.day === k}" title="The sun's path on that day, and the air's normal temperature for that month">${l}</button>`).join('')}</span>` : ''}
            <span class="mini sc-enhint">${lens === 'off' ? 'Off. Pick a view to read every roof round you: what covers it, which shingle, its heat, its wear, what a storm would do to it, and the years ahead. <b>X</b> in the view steps through them.' : esc((LENS.list.find(x => x[0] === lens) || [0, 0, ''])[2]) + '.'}</span>
          </div>
          <div class="sc-enrow" role="group" aria-label="How you move">
            <span class="sc-enlab">Move</span>
            <span class="seg">${[['street', 'Street', 'Along the streets and alleys'], ['walk', 'Walk', 'On foot anywhere, stopped by walls'], ['drone', 'Drone', '38 m up: the height a roof inspection drone flies'], ['bird', 'Bird', '120 m up'], ['metro', 'Metro', '1,400 m up: the city for kilometres round, to the skyline'], ['orbit', 'Orbit', 'Circle the building']].map(([k, l, tip]) => `<button type="button" data-h="${k}" aria-pressed="${mode === k}" title="${tip}">${l}</button>`).join('')}</span>
            <span class="seg sc-craft" role="group" aria-label="Aircraft">${[['alta', 'Alta X', fly ? 'Fly a Freefly Alta X Gen2, built to its published dimensions: it takes off, holds position, lands on roofs, and runs its batteries down in the published time. It flies dry or in light rain only' : 'The atlas keeps the Alta X down in this weather: Freefly designs it to withstand light rain (IP43) and publishes no limit beyond that'], ['saucer', 'Flying saucer', 'Drawn after the classic flying saucer of the 1950s photographs; here it flies in any weather, faster the higher it is, and warps to an address or coordinates in Louisiana, standing on its edge first'], ['tictac', 'The Tic Tac', 'Drawn after the white object Navy pilots from the Nimitz reported in 2004; here it flies in any weather and warps to an address or coordinates in Louisiana without turning on its side']].map(([k, l, tip]) => `<button type="button" data-h="${k}" aria-pressed="${mode === k}" class="${k === 'alta' && !fly ? 'nofly' : ''}" title="${esc(tip)}">${l}</button>`).join('')}</span>
            ${mode === 'alta' ? `<span class="seg" role="group" aria-label="The Alta X"><button type="button" data-al="camera" title="Its payload camera, or the view from behind it (C)">${gNow && gNow.altaCam === 'payload' ? 'Chase view' : 'Payload camera'}</button><button type="button" data-al="home" title="Fly back to where it took off and land (H)">Return home</button><button type="button" data-al="land" title="Land where it is, or take off (L)">${st && st.alta && st.alta.mode === 'Landed' ? 'Take off' : 'Land'}</button></span>` : ''}
            ${isU ? `<span class="seg" role="group" aria-label="The craft"><button type="button" data-ua="camera" title="Look down from under it, or from behind it (C)">${gNow && gNow.uapCam === 'belly' ? 'Chase view' : 'Look down'}</button></span><form class="sc-warp" id="scWarpF" autocomplete="off"><label for="scWarp">Gravity warp to</label><input type="search" id="scWarp" placeholder="An address in Louisiana, or 29.9511, -90.0715" value="${esc(warpQ)}"${warping ? ' disabled' : ''}><select id="scWarpTo" aria-label="Or a Louisiana city"${warping ? ' disabled' : ''}><option value="">or a city</option>${WARP_TO.map(c => `<option>${c[0]}</option>`).join('')}</select><button type="submit" class="btn sm"${warping ? ' disabled' : ''}>${warping ? 'Warping' : 'Warp'}</button></form>` : ''}
          </div>
          <div class="sc-enrow sc-storm" role="group" aria-label="Storm scale">
            <span class="sc-enlab">Storm scale</span>
            <span class="sc-stormw"><input type="range" id="scEnStorm" min="0" max="9" step="1" value="${lv}" aria-label="Storm scale: dry, light rain, heavy rain, severe thunderstorm, tropical storm, then hurricane Categories 1 to 5" aria-valuetext="${esc(gNow && gNow.stormInfo ? gNow.stormInfo.name : 'No storm')}"><span class="sc-stormt" aria-hidden="true">${STORM_T.map((x, k) => `<i class="${k === lv ? 'on' : ''}">${x}</i>`).join('')}</span></span>
            <output id="scEnStormO" for="scEnStorm">${stormText(gNow)}</output>
            <span class="sc-fly ${fly ? 'ok' : 'no'}">${fly ? 'Alta X can fly' : 'Alta X grounded'}</span>
            <button type="button" class="ibtn" data-a="sound" aria-pressed="${enSound}" title="The rain, the wind and the thunder, which comes later by its distance">${enSound ? 'Sound on' : 'Sound off'}</button>
          </div>
          <div class="sc-svctl">
            ${b && svList.length > 1 ? `<button type="button" class="ibtn" data-a="prev" title="The previous building (likely ones first, highest scores first)" aria-label="Previous building">◀</button><span class="mini sc-svn">${N(i + 1)} of ${N(svList.length)}</span><button type="button" class="ibtn" data-a="next" title="The next building" aria-label="Next building">▶</button>` : ''}
            ${b ? '<button type="button" class="ibtn" data-a="face" title="Turn to face the building">Face it</button>' : ''}
            ${b ? `<span class="seg sc-svck" role="group" aria-label="Your field check">${[['g', 'Likely'], ['o', 'Maybe'], ['r', 'Not likely']].map(([k, l]) => `<button type="button" data-ck="${k}" aria-pressed="${!!(CK[b.id] && CK[b.id].s === k)}" title="Mark what you see: ${l.toLowerCase()}">${l}</button>`).join('')}</span>` : ''}
            ${enMenu()}
            <button type="button" class="ibtn" data-a="full">${svFull ? '⤡ Exit full window' : '⤢ Full window'}</button>
            <button type="button" class="ibtn" data-a="classic" title="The three.js street view, with the AI tracing, Google's photoreal tiles and the glTF export">Classic 3D</button>
            <button type="button" class="btn sm" data-a="map">Back to satellite</button>
          </div>
          <div class="sc-svwhere" id="scEnWhere">${whereEn(st)}</div>`;
        const focusEn = () => { try { en.canvas.focus({ preventScroll: true }); } catch (e) { /* fine */ } };
        $$('[data-a]', enBar).forEach(x => x.onclick = () => { const a = x.dataset.a;
          if (a === 'map') setMode('map'); else if (a === 'full') full(!svFull); else if (a === 'face' && en && b) en.face(b);
          else if (a === 'prev' || a === 'next') { if (!svList.length) return; const cur = b ? svList.indexOf(b.id) : -1, k = ((cur + (a === 'next' ? 1 : -1)) % svList.length + svList.length) % svList.length; if (B.get(svList[k])) pick(svList[k]); }
          else if (a === 'editor' && en) { en.editor(!en.editing); renderEnBar(); } else if (a === 'crate' && en) en.dropCrate();
          else if (a === 'play' && en) { enPlay(!enPlayT); renderEnBar(); }
          else if (a === 'sound' && en) { enSound = !!en.sound(!enSound); renderEnBar(); }
          else if (a === 'classic') { const s2 = en ? en.state() : null; open3D(b ? { lat: b.lat, lon: b.lon, street: b.street, b } : s2 ? { lat: s2.lat, lon: s2.lon, street: '', b: null } : t); } });
        $$('[data-h]', enBar).forEach(x => x.onclick = () => { if (en) { en.setHeight(x.dataset.h); renderEnBar(); focusEn(); } });
        $$('[data-lens]', enBar).forEach(x => x.onclick = () => { if (!en) return; if (x.dataset.lens !== 'time') enPlay(false); en.setGraphics({ lens: x.dataset.lens }); renderEnBar(); focusEn(); });
        $$('[data-al]', enBar).forEach(x => x.onclick = () => { if (!en) return; const a = x.dataset.al; if (a === 'camera') en.alta.camera(); else if (a === 'home') en.alta.home(); else { const s3 = en.state(); if (s3.alta && s3.alta.mode === 'Landed') en.alta.takeoff(); else en.alta.land(); } setTimeout(renderEnBar, 60); focusEn(); });
        const gd = $('#scEnGfx', enBar); if (gd) gd.addEventListener('toggle', () => { enGfxOpen = gd.open; });
        $$('[data-ua]', enBar).forEach(x => x.onclick = () => { if (en) { en.uap.camera(); renderEnBar(); focusEn(); } });
        const wf = $('#scWarpF', enBar); if (wf) { const wi = $('#scWarp', enBar), ws = $('#scWarpTo', enBar); wf.onsubmit = e => { e.preventDefault(); warpGo(wi.value.trim()); }; wi.oninput = () => { warpQ = wi.value; }; ws.onchange = () => { const c = WARP_TO.find(x => x[0] === ws.value); if (c) warpGo(c[0], c); }; }
        /* the storm scale slides without the bar being drawn again under the hand */
        const sr = $('#scEnStorm', enBar); if (sr) { sr.oninput = () => { if (!en) return; const v = +sr.value, g2 = en.setGraphics({ storm: v }), ok = !g2.stormInfo || g2.stormInfo.fly, f = $('.sc-fly', enBar); $('#scEnStormO', enBar).innerHTML = stormText(g2); sr.setAttribute('aria-valuetext', g2.stormInfo ? g2.stormInfo.name : 'No storm'); $$('.sc-stormt i', enBar).forEach((x, k) => x.classList.toggle('on', k === v)); if (f) { f.className = 'sc-fly ' + (ok ? 'ok' : 'no'); f.textContent = ok ? 'Alta X can fly' : 'Alta X grounded'; } }; sr.onchange = () => { const had = document.activeElement === sr; renderEnBar(); const n2 = $('#scEnStorm', enBar); if (had && n2) { try { n2.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }; }
        $$('[data-eg]', enBar).forEach(x => x.onclick = () => { const [k, v] = x.dataset.eg.split(':'); if (!en) return; en.setGraphics(k === 'trees' || k === 'life' || k === 'live' || k === 'wide' || k === 'roofKit' ? { [k]: v === 'on' } : { [k]: v }); renderEnBar(); });
        const hr = $('#scEnHour', enBar); if (hr) { hr.oninput = () => { const v = +hr.value; $('#scEnHourO', enBar).textContent = hhmm(v); if (en) en.setGraphics({ sun: v }); }; hr.onchange = () => renderEnBar(); }
        const yr = $('#scEnYear', enBar); if (yr) { yr.oninput = () => { const v = +yr.value; $('#scEnYearO', enBar).textContent = yearText(v); if (en) en.setGraphics({ year: v }); }; yr.onchange = () => { if (enPlayT) { enPlay(false); renderEnBar(); } }; }
        $$('[data-ck]', enBar).forEach(x => x.onclick = () => { const k = x.dataset.ck, cur = CK[b.id] && CK[b.id].s; setCheck(b.id, { s: cur === k ? undefined : k }); statusOf(b); draw(b); refreshSoon(); renderEnBar(); if (en) en.refresh(); if (sel && sel.type === 'b' && sel.id === b.id) detail(); });
      }
      $$('#scEnPad button', root).forEach(x => {
        const k = x.dataset.k, on = e => { e.preventDefault(); if (en) en.hold(k, true); }, off = () => { if (en) en.hold(k, false); };
        x.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => x.addEventListener(ev, off));
        x.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); if (!en) return; if (['alta', 'saucer', 'tictac'].includes(en.state().mode)) { en.hold(k, true); setTimeout(() => en.hold(k, false), 600); return; } if (k === 'fwd') en.walk(8); else if (k === 'back') en.walk(-8); else if (k === 'left' || k === 'right') en.turn(k === 'left' ? -20 : 20); });
      });
      setInterval(() => { if (enMode && en) whereEnSoon(); }, 1000);

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
        const header = ['status', 'score', 'likely_need', 'address', 'city', 'zip', 'parish', 'use', 'fema_occupancy', 'footprint_sqft', 'height_m', 'roof_squares', 'year_built', 'year_built_source', 'last_roof_permit', 'last_roof_permit_work', 'roof_permits_on_file', 'likely_roof', 'roof_odds', 'slope', 'roof_age_mean', 'p_replace_5yr', 'p_repair_12mo', 'p_wind_damage_open', 'p_hail_damage_open', 'p_first_roof', 'p_roof_from_reroof_permit', 'p_roof_20_plus', 'storm_rebuild', 'p_roofer_15yr', 'p_replaced_15yr', 'likely_damage_15yr', 'service_lines', 'field_check', 'field_cues', 'field_note', 'lat', 'lon', 'street_view'];
        const rows = bs.map(b => { const ck = CK[b.id] || {}, rf = b.roof, has = !!(rf.keys && rf.keys.length), top = b.state.storms && b.state.storms[0]; let O = null; if (has) { try { O = outlookOf(b, { heat: 1 }); } catch (e) { O = null; } } return [STL[b.status], b.sc.score, needLabel(b), b.addr ? title(b.addr) : '', b.city ? title(b.city) : (b.z ? b.z.city : ''), b.zip || '', b.fips ? CNAME(b.fips) : '', (PROF[b.cls] || PROF.unk).l, [b.occ, b.prim].filter(Boolean).join(' / '), Math.round(b.sqft || 0), b.h ? +(+b.h).toFixed(1) : '', rf.squares || '',
          b.yb || '', b.ybSrc === 'parcel' ? `${b.parcel && b.parcel.parish ? b.parcel.parish : PNAME(b.fips) || 'the'} Parish tax roll (parcel layer)` : b.ybSrc === 'permit' ? 'new construction permit' : 'estimated from the ZIP', b.last ? b.last.d : '', b.last ? String(b.last.desc).slice(0, 120) : '', b.permits.filter(p => p.kind !== 'newc' && p.w >= 0.15).length,
          rf.name, rf.mix ? rf.mix.map(([l, p]) => `${l} ${Math.round(p * 100)}%`).join('; ') : '', has ? rf.slope : '', has ? +b.state.age.toFixed(1) : '', +b.sc.P5.toFixed(3), +b.sc.REP.toFixed(3), +b.sc.WIND.toFixed(3), +b.sc.HAIL.toFixed(3), has ? +b.state.pOrig.toFixed(3) : '', has && b.strong ? +(b.state.pPerm || 0).toFixed(3) : '', has ? +b.state.pOld20.toFixed(3) : '', top && top.si != null && top.share >= 0.08 ? `${stormName(SIDS[top.si])} ${Math.round(top.share * 100)}%` : '', O ? +O.all.any[OUT_Y].toFixed(3) : '', O ? +O.all.rep[OUT_Y].toFixed(3) : '', O ? (k => (k.c === 'wind' ? 'Wind (' + WIND_FROM[k.sub] + ')' : k.l))(causeRank(O.all, OUT_Y)[0]) : '', b.lines.map(lineName).join('; '),
          ck.s ? STL[ck.s] : '', (ck.cues || []).map(k => (CUES.find(c => c[0] === k) || [k, k])[1]).join('; '), ck.note || '', +b.lat.toFixed(6), +b.lon.toFixed(6), svURL({ lat: b.lat, lon: b.lon })].map(cell); });
        const zips = [...new Set(bs.map(b => b.zip).filter(Boolean))], d = new Date().toISOString().slice(0, 10);
        saveFile(`louisiana-rooftop-scout-${zips.length === 1 ? zips[0] : 'view'}-${d}.csv`, '\uFEFF' + toCSV(header, rows, `Rooftop Scout, Uplift Louisiana Roofing Atlas, ${d}. Model estimates from public records, not inspections: a status is a probability.\nScore: chance of at least one paid roofing job (a replacement within five years, a repair call within twelve months, or wind or hail damage still open). Green at ${CFG.green} or more, orange at ${CFG.orange}.\np_roofer_15yr, p_replaced_15yr, likely_damage_15yr: the 15 year outlook, the chance of any roofing job and of a replacement by ${THIS_YEAR + OUT_Y} and the damage most likely to bring a roofer, from the storm, hail and wind record of the ZIP and those round it and the roof's likely age and covering (without the roof's own heat). Odds from records and stated judgments, not a forecast of a storm.\nSources: FEMA USA Structures; Lafayette and Vermilion Parish tax rolls (public parcel layer); City of New Orleans and East Baton Rouge Parish permits; NOAA Storm Events; NHC best tracks modeled to ZIP codes; the atlas roof age model (module 17). Street View links open Google Maps.`));
      }

      /* ---------- the method, settings, caveats, gaps and sources ---------- */
      /* for the method's text: the wind hazard a covering takes against shingles, over roofs past five years old at Louisiana's ages */
      const past5 = (k, wind) => { const g = gFor(k).w; let x = 0, n = 0; for (let a = 5; a <= AGE_MAX; a++) { x += AGEW[a] * g[a]; n += AGEW[a]; } return n ? wind * x / n : wind; };
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
        `<b>The Scout Engine ${G('C')}</b>. The same neighborhood drawn by a renderer written for this page on WebGL2, with no library: the buildings the dashboard holds on their FEMA footprints at their recorded heights (a usual height for the building's kind where none is on file), each under a hipped roof, or a flat one behind a parapet where its roof is low slope (a shape chosen by the building's kind, not measured); a physical sky with the sun where it stands at the chosen day and hour, bounced light, reflections and shadows; the satellite photo on the ground, trees where the photo shows crowns, streets from OpenStreetMap or the Census file; and the wider city out to the skyline, from FEMA's footprints with OpenStreetMap's where it has newer ones. Walk, fly the Alta X or circle a building. Window grids, cars, signals, sidewalks and rooftop equipment are generated, not observed. Its three roof views read the roofs nearest the camera (45 to 170 of them by the Scene's quality, within about 200 to 380 m) and are seen through trees and walls.`,
        `<b>Roof view: Thermal ${G('C')}</b>. How hot each roof plane runs at the chosen day and hour, from a steady energy balance on the plane. Sunlight: the clear sky beam and diffuse light for the sun's height (Meinel's fit, with Kasten and Young's air mass), cut for the chosen weather, falling on the plane at its slope and bearing, less what tree crowns and nearby buildings shade at that hour. The roof takes in what it does not reflect: by covering, dark shingles 0.04 up to light ones 0.26 and aged white membranes near 0.68 (Florida Solar Energy Center and the Cool Roof Rating Council), painted metal 0.08 to 0.62, and bare aluminium zinc steel, which reflects well but sheds heat poorly (Oak Ridge); where in its range a roof sits comes from how light it shows in the satellite photo. It gives heat back to the air through a film of 12 W per square metre and kelvin, the low end of the 12 to 20 measured on roofs (Berdahl and others 2008) and the value at which the balance meets measured roof temperatures (a calibration: no wind is measured), and as long wave radiation to the sky. The air is NOAA's 1991 to 2020 normal for the month, blended by distance from seven Louisiana stations and shaped through the day. Against measurements: a dark shingle in July afternoon sun comes out near 170°F over 90°F air (the Florida Solar Energy Center measured 179°F at most in a summer; IBHS about 165°F on a June day, and Oak Ridge the same) and a white roof near 115°F (Oak Ridge measured about 115°F on white painted metal). Run over a normal year, without shade, the same balance gives each plane a rate of heat ageing (chemical ageing about doubles for every 10°C: Berdahl and others 2008). The roof's rate against the average roof of its kind there, held between 0.5 and 1.6, stretches or shortens its life in the outlook below by the square root of that ratio (judgment; that damping is what takes a TPO membrane's life from about 25 years at 160°F to about 12 at 200°F in one maker's heat ageing tests). The card's outlook takes a roof's heat once the engine has read its planes, and says so; the CSV leaves it out.`,
        `<b>Roof view: Wear ${G('D')}</b>. What age and weather have taken from each roof so far, from sound to worn out: the roof's likely age over the mean life of its kind (the roof's age, above; at 100 percent half of such roofs have been replaced), worked harder on the planes that run hottest; what the storms it has stood through left (each tropical storm year of 58 mph or more, by the chance today's roof was already on and by what the year cost the ZIP's roofs, told most at the ridge and edges); wind and hail reported near it and still open; algae where it stays damp (shaded and north planes; how soon it shows is a judgment) and rust on metal near the Gulf's open shore (makers void their warranties on bare aluminium zinc steel within 400 to 2,800 feet of salt water, a mile at one; the model measures to the open coast only and does not see Lake Pontchartrain, the bays or the marsh canals). The marks on a roof (lifted tabs, hail spatter, worn patches, streaks, rust) show which of those is strongest at each spot. They are drawn by rule, not seen.`,
        `<b>The next 15 years, and the Time view ${G('D')}</b>. For each covering the building may carry and each year its roof may date from, the outlook follows the building year by year for ${OUT_Y} years: the roof then in place and what reaches it; a roof that is replaced starts again at age zero. Much of it is counted from records and the rest is stated judgment, which is why it is graded D. <i>Wear</i>: the roof's Weibull life, as above, shortened or stretched by its heat where the engine has read it. <i>Hurricanes and tropical storms</i>: the ZIP's storm years as the roof's age above counts them, the share of roofs each one replaced: from ${OC.femaFrom} module 17's count (FEMA's verified damage where FEMA has it, the storm's modeled wind elsewhere); before ${OC.femaFrom} the modeled wind through module 02's damage curve, scaled by how FEMA's counts have compared with that curve since (about ${D(curveK()[2], 1)} of it for a year of 74 to 91 mph winds and ${D(curveK()[3], 1)} above). A ZIP's own record counts for ${pct(OC.own)} and the ZIPs within ${D(OC.nearKm, 0)} km, by their roofs, for the rest. Two records are kept: the years since ${OC.recFrom}, which the atlas resolves storm by storm, and the ${OC.longTo - OC.longFrom + 1} years since ${OC.longFrom}, for which module 02 counts each ZIP's years of 58 and 74 mph winds; those earlier years are given the mean cost of a storm year of their strength. Statewide the first replaces about 2.5 percent of roofs a year and the second about 2.1; the outlook uses their mean unless the card's Storm record says otherwise. Beside the roofs a storm year replaces are those it damages and a roofer repairs: about three more for each one replaced in a mild year and about one in a hard one, set from the one survey that counted damage where the atlas has a count (after Gustav in Houma IBHS found roof cover damage on 65 percent of 933 houses, on more than 5 percent of the roof on 27 percent; the atlas has 23 to 49 percent of the roofs standing in Houma's three ZIPs replaced that year). <i>Age against wind</i>: a young shingle roof resists far better than an old one. The University of Florida found no partly unsealed shingles in the field of roofs under four years old and 30 percent of strips unsealed at 14 to 20 (hip and ridge caps were unsealed at every age); in Laura 40 percent of two to three year old shingle roofs near Lake Charles were damaged against 97 percent of those 14 to 15 years old (NIST, 623 homes); in the 2020 derecho roofs over ten years old were damaged five times as often as those of three to six (IBHS). The outlook's multiple is a judgment drawn through those: a shingle roof under four years old takes about ${D(gFor(1).w[2], 2)} times the average roof's hazard and one of twenty about ${D(gFor(1).w[20], 1)} times, scaled so that Louisiana's roofs at their ages today average each storm year's count. That spread is wider than the five to ninefold differences those surveys measured between young and old roofs; it is set so that Laura's 40 percent for young roofs comes out of a storm year that replaces six roofs in ten, as the atlas has round Lake Charles in 2020. Metal, tile and slate age another way: their odds stay low for ten years and rise after (in Ian damage was rare on any roof under five years old, and on metal and tile it barely rose until past ten; the rise after ten is a judgment, and nothing was found on slate in hurricanes, which is taken with tile). <i>Thunderstorm wind and tornadoes</i>: the days a year with wind of 58 and of 75 mph and with EF1 tornadoes within 25 miles (SPC, 1996 to 2025) at module 12's stated rates of roofs damaged a day (${D(OC.ts[0][0] * 100, 2)}, ${D(OC.ts[1][0] * 100, 2)} and ${D(OC.ts[2][0] * 100, 2)} percent, grade D). <i>Hail</i>: the days with hail of 1 inch and of 1.75 inches within 25 miles at module 12's rates (${D(OC.hail[0][0] * 100, 2)} and ${D(OC.hail[1][0] * 100, 2)} percent), turned for each covering by the size of hail that damages it (Haag Engineering: three tab shingles 1 inch, laminated 1.25, clay tile and gray slate 1.5, concrete tile and green slate 1.75, single ply membranes 1 to 2, steel panels 2.5, which dent sooner). <i>Leaks</i>: the repair line's calls by roof age. <i>Coverings</i>: over roofs past five years old the model gives metal on a home, and tile and slate, about ${D(past5('hard', RTYPE.metal.wind) / past5(1, 1), 1)} of a shingle roof's wind hazard (a judgment: in Ian 10 to 15 percent of metal and tile roofs past five years showed damage on 5 percent or more of the roof, against almost half of shingle roofs, about 0.2 as a hazard; the roof's age above takes metal at ${D(SMAT.metal, 2)} at every age, itself a judgment); membranes and metal buildings take wind at ${D(RTYPE.low.wind, 1)} of the shingle rate and manufactured homes at ${D(RTYPE.mh.wind, 1)} (module 12). Out come the chances, by each year, of each kind of damage at least once at this address, of a roofer being needed, and of the roof being replaced (one minus the chance today's roof is still on), on the card and for each kind of roof the building may carry. The Time view paints them on the roofs: at each spot the damage most likely to have reached it by the chosen year, brighter as the chance grows. Wind shows first at ridge and hip caps and a little more at the edges than in the field (ASCE 7 puts the hardest uplift there, though after Gustav and Ike IBHS found shingle damage about as often in the middle of a slope as along its edge); heat and age on the planes that run hottest; hail on every plane alike; leaks at edges and ridges; rust at the edges of metal.`,
        `<b>Roof view: Covering and Shingle style ${G('D')}</b>. <i>Covering</i> paints each roof with the covering it most likely carries (the likely roof, above: the building's kind, size and height and its ZIP's share of metal roofs), stronger the surer it is, and draws a common size of that covering in the plane of the roof, from makers' data sheets: three tab strips in the 36 inch size (12 inch tabs at a 5 inch exposure; metric three tabs run 13 1/8 inch tabs at 5 5/8), laminated shingles at 5 5/8 inches, standing seam at 16 inches (also sold at 12), ribbed panels with ribs at 12 inches and their screws showing, barrel tile at 8 1/4 by 10 1/4 inches to the weather, a white membrane's 10 foot sheets (one of the four widths TPO comes in) or the metre wide rolls of a modified bitumen cap sheet. Shingles are drawn three tab or laminated, whichever the Shingle style view finds likelier. A low slope roof is drawn white where it shows very light in the satellite photo and dark otherwise; nothing else is read from the photo. The records cannot tell standing seam from 5V crimp or ribbed panels on a house, so metal on a house is drawn as standing seam and the key says it may be any of the three. <i>Shingle style</i> says which shingle a shingle roof most likely is, three tab or laminated (architectural), from when it most likely went on (the roof's age, above, as a spread of years) and the share of each sold in the United States that year: laminated shingles were 7 percent of the asphalt shingles sold in 1984, 23 in 1994, 46 in 2000, 59 in 2003, about 70 in 2010, about 86 over 2015 to 2020 and 95 in 2024 and 2025 (Elcor's and GAF's filings to 2006, Fine Homebuilding for 2010, Owens Corning's investor reports after; one second hand figure, 5 percent in 1980, is held for every earlier year; 2011 to 2014 were not found and are drawn straight; 2015 to 2023 are measured off an unlabelled Owens Corning chart that gives 2015 to 2020 only as one average, which the atlas spreads from 83 to 89, a judgment). No split for Louisiana was found, and Louisiana's rules set a wind class for shingles, not a style, so the view is graded D: a likelihood from age and national sales, not a reading of the roof.`,
        `<b>The storm scale, and the Storm view ${G('D')}</b>. The scale sets the weather in the Scout Engine in ten steps: dry, light rain, heavy rain, a severe thunderstorm, a tropical storm and hurricane Categories 1 to 5. The hurricane steps are the Saffir-Simpson Hurricane Wind Scale's sustained winds (74, 96, 111, 130 and 157 mph and up), drawn at the middle of each range and at 165 mph for Category 5; the winds of the steps below a tropical storm are chosen, and gusts are the drawn wind times 1.23, the figure for wind coming off the sea (well inland it is nearer 1.5). The rain is a rate chosen for each step, a judgment: the federal observing handbook calls rain heavy over 7.6 mm an hour, a hurricane's rain averaged right round the storm runs 3 to 12, and one satellite pass over a hurricane caught a band at about 90 and the eyewall over 140. From the rate come the size of the drops, how fast they fall, how far one can see, and how hard the wind drives them: a hurricane's rain is drawn nearly level. Lightning is frequent in the thunderstorm and rare in the hurricane steps, as it is in a real hurricane's core. What is drawn is a picture of such weather, not a forecast and not a simulation of a named storm. From Category 3 up, within reach of the Gulf, flood water is drawn: its height at the open shore is the old Saffir-Simpson scale's surge for the category (the middle of 9 to 12 and 13 to 18 feet; 20 feet for Category 5 is a judgment, the old scale saying only more than 18), thinning inland to nothing a little past the farthest the Hurricane Center's reports put surge in southwest Louisiana (Rita, Category 3 at landfall: up the Calcasieu River to Interstate 10 at Lake Charles, about 25 nautical miles in, where it still stood up to 6 feet deep; Laura, Category 4: 20 to 30 nautical miles): 56 km for Category 3, 65 for Category 4 and, a judgment, 75 for Category 5, over ground taken as 1 m above the sea. Levees, floodwalls and the lie of the ground are not in it, and surge has come by lakes, bayous and ship channels to places this picture leaves dry (Ida left 8 feet at LaPlace, by Lake Pontchartrain), so it is a picture of surge and no more: where it draws no water it does not say none would come. Below Category 3 none is drawn, a choice of the picture: the old scale gave 4 to 5 feet for Category 1 and 6 to 8 for Category 2. <i>The Storm view</i> shows what the step on the scale would do to each roof. For a tropical storm or hurricane, the share of a ZIP's roofs a storm with that sustained wind replaces is the atlas's own damage curve (module 02, fitted to FEMA's counts), scaled by how FEMA's counts have compared with that curve since 2004 (about ${D(curveK()[2], 1)} of it for a year of 74 to 91 mph winds and ${D(curveK()[3], 1)} above), to the top of Category 3. The curve is flat above about 110 mph because Louisiana's record holds few stronger winds, so for Categories 4 and 5 it is carried up on one anchor from another state: in the South Florida neighbourhoods surveyed after Andrew (1992), where 3 second gusts likely passed 155 mph and may have reached 175, 23 to 30 percent of homes lost a third to two thirds of their roof cover and 36 to 47 percent lost more, 59 to 77 percent together (the atlas's sum). By the scale's own gust figure those gusts go with the Category 4 step, so the atlas sets the middle, 68 percent, there, and the top, 77 percent, at Category 5, for which no survey was found. All of that is a judgment. Each roof then takes that storm by its covering, its height and the ages it may be, exactly as a storm year does in the 15 year outlook, and shows its chance of needing a roofer, with the chance it is replaced beside it. For the severe thunderstorm the rate is module 12's for a day of 58 mph gusts. In rain without wind there is no storm damage to show, so each roof shows its chance of a leak call this year, from the repair line's calls at its age.`,
        `<b>The Alta X, the flying saucer and the Tic Tac</b>. The Alta X is built to Freefly's published dimensions and flight times; Freefly tests it to an IP43 equivalent and says it is designed to withstand light rain, so the atlas keeps it down past light rain on the storm scale: it lands and will not take off. Two more craft fly in any weather and warp to an address or coordinates in Louisiana (places outside the state are refused: this is a Louisiana roofing atlas). The flying saucer is the classic one of the 1950s photographs and of the disc the Air Force had Avro design (Project 1794: 35.3 feet across); the Tic Tac is the white, smooth object, 40 feet long by Commander David Fravor's sworn account, that Navy pilots described meeting off California in 2004. How they look follows those descriptions; how they fly is invented. They are a way to look at roofs, and nothing in the atlas's numbers depends on them.`,
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
        ['The Scout Engine draws a likeness', 'Its buildings stand on FEMA\'s footprints at their recorded heights (a usual height where none is on file), under a hipped or flat roof chosen by the building\'s kind, not measured; windows, doors, cars, signals, sidewalks and rooftop equipment are generated. Judge a real roof on the satellite photo, in Street View or on the roof.'],
        ['The roof views are a model, not a camera', 'Thermal is an energy balance from the sun, the covering\'s likely reflectance and normal air temperatures; a real roof on a real day differs with its exact colour, its attic\'s ventilation and the breeze. Wear is the roof\'s likely age and the weather on record, not what an inspector would find, and its marks are drawn by rule.'],
        ['The next 15 years are odds', 'The outlook says how often roofs like this one, in this place, have been damaged, and assumes the next 15 years bring weather like the record. One hurricane decides most of it, and no record says which year. The years since 1990 were harder on Louisiana than the forty before; the card shows both records and uses their mean. How much a roof\'s age counts against wind, how many roofs are repaired for each one replaced, and the damage a hail or wind day does are judgments, each stated in the method.'],
        ['Hurricane counts lean on FEMA\'s registrations', 'From 2004 a storm year\'s cost at a ZIP is module 17\'s count: FEMA\'s registrations for roof and wind damage where FEMA has them, the storm\'s modeled wind where it does not. FEMA\'s count runs low where flood did the damage (much of New Orleans and St. Bernard in Katrina) and where fewer owners registered. The modeled wind is read through the atlas\'s damage curve, which was fitted on Katrina, Rita, Gustav, Ike and Isaac and has read higher than FEMA\'s counts in every hurricane year but 2005; before 2004 the outlook scales it by that difference, a correction, not a measurement. The ZIPs around it steady a ZIP\'s record only partly.'],
        ['The outlook does not know how the roof was built', 'A FORTIFIED roof (which cut the number of wind claims by more than half after Hurricane Sally in Alabama\'s study), an impact rated shingle, a second layer or poor nailing would each move the odds, and no public file records them. Where the covering itself is only a likelihood, the card shows each kind of roof apart.'],
        ['The storm on the scale is a picture', 'The rain, wind, cloud, lightning, flying debris and flood water in the Scout Engine are drawn to look like the step chosen, from the scale\'s winds and typical rain rates. They are not a forecast, not a named storm, and not a flood map: the flood water knows nothing of levees, floodwalls, waterways or the ground\'s height, and where none is drawn that is the picture\'s edge, not a promise of dry ground. The rain rates, and the winds of the steps below a tropical storm, are chosen, not measured. The Storm view\'s odds are the atlas\'s damage record applied to one storm; above Category 3 they rest on a judgment, because Louisiana\'s record holds too few such winds.'],
        ['Covering and shingle style are likelihoods', 'None of the files the atlas reads records what covers a roof or which shingle it is. Covering is the building\'s kind and its ZIP\'s share of metal roofs; shingle style is the roof\'s likely age against national sales of three tab and laminated shingles by year. A 2018 homeowner survey still found three tab the commonest choice for a replacement roof, and in 2023 three tab was on 64 percent of the shingle roofs in Georgia\'s insurance claims (no figure for Louisiana), so older roofs here may be three tab more often than national sales suggest. The patterns drawn on the roofs are the likely covering at a common size, not what the photo shows.'],
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
        ['Scout Engine', 'A WebGL2 renderer written for this page and carried in the file: deferred physically based shading, a physical sky, shadows, reflections and bounced light, with no outside library', '', '', ''],
        ['Air temperature (Thermal view)', 'NOAA National Centers for Environmental Information, U.S. Climate Normals 1991 to 2020: monthly normal daily maximum and minimum at New Orleans, Baton Rouge, Lafayette, Lake Charles, Alexandria, Shreveport and Monroe, blended by distance', 'A', '1991 to 2020', 'https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals'],
        ['Roof reflectance and temperature', 'Florida Solar Energy Center (Parker and others: reflectance of roofing materials, FSEC-CR-670-00; measured roof and attic temperatures, FSEC-PF-337-98, FSEC-CR-1220-00 and CR-1411-03); the Cool Roof Rating Council\'s rated products directory; Oak Ridge National Laboratory and the Metal Construction Association (Miller and others 2004); IBHS roof aging farms (2015); Berdahl, Akbari, Levinson and Miller 2008 on the weathering of roofing materials', 'B', '', 'https://publications.energyresearch.ucf.edu/wp-content/uploads/2018/06/FSEC-CR-670-00.pdf'],
        ['Roof age and wind', 'University of Florida (Dixon, Prevatt, Masters and Gurley 2013: unsealed shingles by roof age); NIST (Mohamed, Kovar, Lombardo and Brown-Giammanco 2026: roof age in Hurricane Laura, 623 homes); IBHS (Liu and others 2010: shingle roofs after Gustav in Houma and Ike in Texas; Giammanco, Weston and Pogorzelski 2023: the 2020 derecho); University of Florida and Auburn University for the Florida Building Commission (2023: shingle, tile and metal roofs in Ian)', 'B', '', 'https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=961089'],
        ['Hail size that damages each covering', 'Haag Engineering: Marshall, Herzog, Morrison and Smith (2002, 2004, American Meteorological Society severe storms conferences); Morrison (2009, Professional Roofing)', 'B', '', 'https://ams.confex.com/ams/pdfpapers/45858.pdf'],
        ['Storm, hail and wind record (the outlook)', 'The atlas: module 17\'s storm driven roof replacements by ZIP and year; module 02\'s storm footprints from 1992 and its counts of each ZIP\'s years with 58 and 74 mph winds since 1950 (NHC best tracks); SPC severe reports 1996 to 2025 as days a year within 25 miles, at module 12\'s stated rates of roofs damaged a day', 'B to D', 'compiled ' + esc(META.compiled || ''), ''],
        ['Metal roofs near salt water', 'Makers\' warranties: no cover for bare 55% aluminium zinc steel within 400 to 2,800 feet of salt water (MBCI, Drexel Metals) or within a mile (Englert); painted panels within 1,000 to 1,500 feet (MBCI, Metal Sales)', 'B', '2020 to 2023', 'https://www.mbci.com/wp-content/uploads/Widen%20Assets/WarrantyCOM23_MBCI_TB002-Marine-Enviro_1201229991104_RevB_MS_0323_WEB.pdf'],
        ['FORTIFIED roofs in a hurricane', 'Alabama Department of Insurance and the University of Alabama\'s Center for Risk and Insurance Research, Performance of IBHS FORTIFIED Home Construction in Hurricane Sally (2025)', 'B', 'May 2025', 'https://www.aldoi.gov/PDF/News/PerformanceIBHSFortifiedHomeConstructionHurricaneSally.pdf'],
        ['Shingle styles by year', 'Laminated shingles\' share of asphalt shingles sold in the United States: Elcor and ElkCorp annual reports (1984 to 2006) and Building Materials Corporation of America (GAF) filings (1996 to 2003), SEC EDGAR; Fine Homebuilding (2010); Owens Corning investor presentations (2015 to 2025, measured off a chart but for 2024 and 2025); Home Innovation Research Labs (2018) and Nearmap (2023) on three tab roofs still in place', 'B to C', '1984 to 2025', 'https://www.sec.gov/Archives/edgar/data/0000032017/000095013495002353/0000950134-95-002353.txt'],
        ['Roofing sizes (the patterns drawn)', 'Makers\' data sheets: GAF, Owens Corning and CertainTeed (shingles); Metal Sales Manufacturing (standing seam, 5V crimp, R panel); Ludowici (barrel tile); Carlisle SynTec (TPO) and Johns Manville (modified bitumen)', 'A', '', 'https://www.metalsales.us.com/wp-content/uploads/2023/06/5V-Crimp-CTR-2023.pdf'],
        ['Storm scale: wind', 'National Hurricane Center, the Saffir-Simpson Hurricane Wind Scale; Harper, Kepert and Ginger (2008, a conference paper toward the World Meteorological Organization\'s guideline) on gusts over sustained winds', 'A to B', '', 'https://www.nhc.noaa.gov/aboutsshws.php'],
        ['Storm scale: rain and lightning', 'Federal Meteorological Handbook No. 1 (rain intensity); Marshall and Palmer (1948) and Atlas, Srivastava and Sekhon (1973) on the size and fall speed of raindrops; Lonfat, Marks and Chen (2003) on rain rates in tropical cyclones; NASA\'s Global Precipitation Measurement mission on Hurricane Lane (2018); NOAA Hurricane Research Division on lightning in hurricanes. The rate drawn for each step is a judgment', 'B', '', 'https://www.icams-portal.gov/resources/ofcm/fmh/FMH1/fmh1_2019.pdf'],
        ['Storm surge (the flood drawn)', 'The Saffir-Simpson Hurricane Scale as the National Hurricane Center published it until 2010 (surge by category); NHC Tropical Cyclone Reports for Rita (2005) and Laura (2020) (how far inland surge reached in Louisiana)', 'D as used', '', 'https://www.nhc.noaa.gov/data/tcr/AL132020_Laura.pdf'],
        ['Roof cover lost in the strongest winds', 'IBHS (Liu and others 2010), quoting the NAHB Research Center (1993) on Hurricane Andrew: where 3 second gusts likely passed 155 mph, 23 to 30 percent of homes lost a third to two thirds of their roof cover and 36 to 47 percent lost more', 'C', '2010', 'https://ibhs.org/wp-content/uploads/wpmembers/files/Surviving-Natures-Fury-Performance-of-Asphalt-Shingle-Roofs-in-the-Real-World_IBHS.pdf'],
        ['Freefly Alta X in rain', 'Freefly Systems, Alta X Gen2 technical specifications and operating notes: tested to an IP43 equivalent, designed to withstand light rain, no wind limit published; price starting at $39,650', 'A', 'read November 2026', 'https://docs.freeflysystems.com/alta-x-gen2/specs/tech-specs'],
        ['The flying saucer and the Tic Tac (how they look)', 'Commander David Fravor\'s testimony to the House Committee on Oversight and Accountability, 26 July 2023 (Serial No. 118-53); the University of Colorado\'s Scientific Study of Unidentified Flying Objects for the Air Force, 1968 (cases 46 and 52); George Adamski, Inside the Space Ships (1955); Avro Aircraft, Project 1794 Final Development Summary Report (1956), among records the U.S. National Archives posted in 2012', '', '', 'https://www.govinfo.gov/content/pkg/CHRG-118hhrg53022/html/CHRG-118hhrg53022.htm'],
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
        map: () => map, ai: () => ({ on: aiOn(), avail: aiAvail(), layer: !!AI.layer, parentZoom: aiPz(), done: AI.done, queued: AI.queue.length, running: AI.running, ms: AI.ms, err: AI.err, cached: AI.cache.size }), buildings: () => [...B.values()], pick: id => pick(id, { pan: true }), d3: () => d3, open3D: t => open3D(t), en: () => en, openEngine: t => openEngine(t), outlook: (b, o) => outlookOf(b, o), outlookType, hazardAt, stormOn, hurByAge, eventsFor, bandMeans, yearsOf, curveK, ageShares: () => AGEW, lens: LENS, heat: { surfaceC, airC, sunAt, clearSky, heatRate, heatRef, reflectOf, climOf, coastKm }, glows: () => GM.hits.map(h => ({ id: h.b.id, d: h.d, box: [h.x0, h.y0, h.x1, h.y1] })), sv: () => ({ mode: svMode, live: GM.live, cam: GM.cam, failed: GM.failed, n: GM.n, target: svTarget && svTarget.b ? svTarget.b.id : null }), read, roofOf, addrParts, rstate, stormsAt, eventsNear, permitW, aim, svURL, status: () => ({ tiles: [...T.values()].map(t => ({ k: t.k, st: t.st, n: t.ids.size })), queued: Q.list.length, running: Q.run, errors: errors.slice() }),
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
