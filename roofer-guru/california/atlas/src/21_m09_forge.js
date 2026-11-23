/* ==== 21_m09_forge.js ==== */
/* ==== m09_forge ==== */
"use strict";
/* ============================ Module 9: Site Forge (California roofing) ============================ */
/* FORGE plans the page set from the atlas (markets, counties, regions, the event ledger, the thirteen service lines), writes
   each page as a FORGE blueprint from FCOPY and the atlas numbers, lints it with the Compliance Satchel (CSLB licensing, the
   home improvement contract rules, Penal Code 551 and the public adjuster act, FTC rules, house style) and hands it to
   FORGE_COMPILE (Elementor, semantic HTML, JSON-LD, preview). Internal links come only from the live sitemap the user pastes. */
const FORGE = (() => {
  const C = FCOPY;
  const KL = { home: 'Home', about: 'About', practice: 'Service', region: 'Region hub', county: 'County hub', city: 'City', event: 'Event', landing: 'Landing', guide: 'Guide' };
  const LINES = PL.map(l => l.key);
  const LAB = k => (C.AC[k] && C.AC[k].label) || lineName(k);
  /* the lines as running text: "roof replacement, leak repair and wind and rain damage" */
  const RUN = { replace: 'roof replacement', repair: 'leak repair', storm: 'wind and rain damage', fire: 'wildfire repairs and rebuild roofing', harden: 'fire hardened roofs', tile: 'tile lift and relay', solar: 'reroofs under solar panels',
    metal: 'metal roofs', mh: 'manufactured home roofs', mf: 'multifamily roofs', comm: 'commercial roofs', coat: 'roof coatings', newc: 'new construction roofing' };
  /* lower case for running text, keeping HOA, CSLB and other capitals */
  const lc = s => String(s || '').replace(/\b[A-Z][a-z]+\b/g, m => m.toLowerCase());
  const CITY = {}; CITIES.forEach(c => { CITY[c.name] = c; });
  /* placeholders print until the company is set; the house style rule blocks every page that still carries one */
  const PH = { brand: 'Your company', lic: '[license number]', city: 'Your city' };
  const listAnd = a => { a = a.filter(Boolean); return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s => (strip(s).match(/\S+/g) || []).length;
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const firstSentence = s => { const m = String(s).match(/^[\s\S]*?[.!?](?=\s|$)/); return (m ? m[0] : String(s)).trim(); };
  const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const numW = n => n >= 0 && n < 10 ? NUMW[n] : N(n);
  const cnt = n => n >= 1 && n < 10 ? NUMW[n] : N(n);
  const sent = t => { t = houseClean(String(t || '').trim()); return !t || /[.!?]$/.test(t) ? t : t + '.'; };
  /* rounded counts for running text: 233,714 reads "234,000" */
  const roundNice = v => v >= 100000 ? Math.round(v / 1000) * 1000 : v >= 10000 ? Math.round(v / 100) * 100 : v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v);
  const about = v => isN(v) && v >= 0.5 ? N(roundNice(+v)) : null;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ymLong = ym => { const m = String(ym || '').match(/^(\d{4})-(\d{2})/); return m ? MONTHS[+m[2] - 1] + ' ' + m[1] : null; };
  function cleanInline(s) { const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/); return m[1] + houseClean(m[2]) + m[3]; }
  function cleanHTML(h) { return String(h).split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p : (p.trim() ? cleanInline(p) : p)).join(''); }
  const TEXT_KEYS = new Set(['eyebrow', 'lede', 'body', 'text', 'heading', 'caption', 'title', 'label', 'q', 'a', 'quote', 'role', 'value', 'source', 'anchor', 'description', 'transcript', 'link', 'name']);
  function cleanDeep(x, key) {
    if (typeof x === 'string') return key === 'html' ? cleanHTML(x) : TEXT_KEYS.has(key) ? houseClean(x) : x;
    if (Array.isArray(x)) return x.map(v => cleanDeep(v, key === 'rows' || key === 'columns' ? 'text' : key));
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = (k === 'url' || k === 'media' || k === 'id' || k === 'type') ? x[k] : cleanDeep(x[k], k); return o; }
    return x;
  }
  /* sentences that are blank on purpose where the place has no data for them (a hazard column not shipped, a fact that does not apply) */
  const OPT = new Set(['c_hazSentence', 'c_windSentence', 'c_rainSentence', 'c_coolSentence', 'c_fairSentence', 'c_femaSentence', 'co_hazSentence', 'co_windSentence', 'co_rainSentence', 'co_fairSentence', 'co_femaSentence', 'rg_hazSentence', 'rg_windSentence', 'rg_rainSentence']);
  function fill(t, V, missing) {
    if (t == null || typeof t !== 'string') return t;
    return t.replace(/\{([a-zA-Z_]\w*)\}/g, (m, k) => { if (V[k] != null && V[k] !== '') return String(V[k]); if (OPT.has(k)) return ''; if (missing && !missing.includes(k)) missing.push(k); return ''; })
      .replace(/<p>\s*<\/p>/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/^\s*[.,;]\s*/, '').trim();
  }
  function fillDeep(x, V, missing) { if (typeof x === 'string') return fill(x, V, missing); if (Array.isArray(x)) return x.map(y => fillDeep(y, V, missing)); if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = fillDeep(x[k], V, missing); return o; } return x; }
  const officeList = S => [S.city].concat(String(S.offices || '').split(/[,;]\s*/)).map(s => String(s || '').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const CUR = +String(META.compiled || new Date().toISOString()).slice(0, 4);
  const STATE = 'California', ST2 = 'CA';

  /* ====================================================================================================================
     SEAMS TO THE DATA BUILD. Every data column, data block and data year this module reads is named in this block and
     nowhere else (CA/data/SCHEMA.md and CA/data/hazard/HAZARD_SCHEMA.md as they stood on November 23, 2026).
     If the data build renames a column or a key, change it here. A column that is not in the file reads as null, its
     sentence and its fact are dropped, and the page still builds.
     ==================================================================================================================== */
  const HZ = (() => {
    /* counties: core keeps its county arrays under the aliases CO and COI (SCHEMA.md, decision 1); the ZIP column pi indexes them */
    const COUNTIES = typeof CO !== 'undefined' ? CO : (DATA.counties || []);
    const COUNTY_BY_FIPS = typeof COI !== 'undefined' ? COI : {};
    const countyOfIdx = i => COUNTIES[i] || null;
    /* per ZIP columns: logical name -> the column names to try, first present wins (hazard job's working names first, SCHEMA.md stub names second) */
    const COL = {
      fhsz_high: ['fhsz_high'], fhsz_vh: ['fhsz_vh'], fhsz_hv: ['fhsz_sh'],   /* percent of the ZIP's land in High, Very High, and both together */
      fire_dest: ['fire_dest', 'dins_dest'], fire_dmg: ['fire_dmg', 'dins_dmg'],   /* structures destroyed, damaged (CAL FIRE damage inspections) */
      fire_worst: ['fire_worst', 'dins_worst'], fire_worst_yr: ['fire_worst_yr', 'dins_worst_yr'], fire_worst_n: ['fire_worst_dest', 'dins_worst_dest'], lastfire: ['lastfire'],
      g58: ['g58', 'wd58'], gust_max: ['gust_max'],                               /* days a year with a gust of 58 mph or more nearby; highest gust on record, mph */
      ar_d: ['ar_d', 'ar_days'], rain_in: ['rain_in'], h100: ['h100', 'heat100'], snow_psf: ['snow_psf', 'pg_psf'],
      cz: ['cz', 't24cz'],                                                        /* Title 24 energy climate zone 1 to 16 (asked of the data job; not in SCHEMA.md yet) */
      fair_pif: ['fair_pif'], fair_pif22: ['fair_pif22'], fema: ['fema_k'], fema_fire: ['fema_fire'], fema_storm: ['fema_storm'],
      tile_n: ['tile_n'], tile25: ['tile25'], ra25: ['ra25'], span_sh: ['span_sh'], sqmi: ['sqmi'], hu: ['hu'] };
    const zc = (z, k) => { const a = COL[k] || [k]; for (let i = 0; i < a.length; i++) { const v = z[a[i]]; if (v != null && v !== '') return v; } return null; };
    const has = k => Z.length > 0 && (COL[k] || [k]).some(n => n in Z[0]);
    /* what the fire zone share measures, as printed: the hazard job overlays the zone maps on ZIP land area */
    const FHSZ_BASIS = 'of the land';
    const fhsz = z => { const h = zc(z, 'fhsz_high'), v = zc(z, 'fhsz_vh'); if (isN(h) || isN(v)) return Math.min(100, (+h || 0) + (+v || 0)); const b = zc(z, 'fhsz_hv'); return isN(b) ? +b : null; };
    /* years the records cover, as printed */
    const YRS = { dins0: 2013, dins1: Math.min(CUR, 2025), fairDate: 'September 30, 2026', fair0: 2022 };
    /* the event ledger: hazard_events.json, merged into the page data as the top level key hz (HAZARD_SCHEMA.md section 2):
       fires with zfire[zip] = [[fire index, destroyed, damaged, km, percent of the ZIP inside], ...]; ar_big (the AR4, AR5 and notable AR3
       landfalls, a stretch of coast lat0 to lat1); wind with zn = indexes into zones[].zips. Absent from the file, no event page is planned. */
    const RAW = DATA.hz || DATA.hazard_events || {};
    const arr = x => Array.isArray(x) ? x : (x && Array.isArray(x.events) ? x.events : []);
    const fireName = n => { n = String(n || '').trim(); return /\b(fire|complex)$/i.test(n) ? n : n + ' Fire'; };
    const monthOf = e => e.month || (e.start ? +String(e.start).slice(5, 7) : null) || 1;
    const WINDN = { santa_ana: ' Santa Ana wind event', diablo: ' Diablo wind event', sundowner: ' sundowner wind event', mono: ' Mono wind event', winter: ' winter windstorm' };
    function norm(e, kind) {
      const y = +e.year || (e.start ? +String(e.start).slice(0, 4) : null); const mo = monthOf(e); if (!y) return null;
      const when = MONTHS[mo - 1] + ' ' + y;
      const o = { id: String(e.id || kind + y + mo), kind, year: y, month: mo, when, dr: e.dr || null };
      if (kind === 'fire') { o.name = fireName(e.name); o.acres = isN(e.acres) ? +e.acres : (isN(e.gis_acres) ? +e.gis_acres : null); const pick = (a, b) => isN(a) ? +a : (isN(b) ? +b : null); o.dest = pick(e.dest, e.destroyed); o.dmg = pick(e.dmg, e.damaged);
        o.foot = {}; (e.z || []).forEach(r => { o.foot[r[0]] = { pct: +r[1] || 0, dest: +r[2] || 0, dmg: +r[3] || 0 }; }); }
      else { o.rank = isN(e.rank) ? +e.rank : null; const g = Array.isArray(e.gust) ? e.gust[0] : e.gust; o.gust = isN(g) ? Math.round(+g) : null; o.at = e.peak_at || e.stretch || e.where || null;
        o.name = e.name ? String(e.name) : when + (kind === 'ar' ? ' atmospheric river' : (WINDN[e.kind] || ' windstorm'));
        if (Array.isArray(e.z) && e.z.length) { o.foot = {}; e.z.forEach(r => { o.foot[r[0]] = { gust: +r[1] || null }; }); }
        else if (Array.isArray(e.zn) && Array.isArray(RAW.zones)) { o.foot = {}; e.zn.forEach(i => ((RAW.zones[i] || {}).zips || []).forEach(z => { o.foot[z] = {}; })); }
        else if (isN(e.lat0) && isN(e.lat1)) o.band = [Math.min(e.lat0, e.lat1) - 0.25, Math.max(e.lat0, e.lat1) + 0.25]; }
      o.label = o.name + ' (' + y + ')';
      return o;
    }
    const FIRES = arr(RAW.fires).map(e => norm(e, 'fire'));
    Object.entries(RAW.zfire || {}).forEach(([zip, rows]) => (rows || []).forEach(r => { const f = FIRES[r[0]]; if (f && ((+r[4] || 0) > 0 || (+r[1] || 0) + (+r[2] || 0) > 0)) f.foot[zip] = { pct: +r[4] || 0, dest: +r[1] || 0, dmg: +r[2] || 0 }; }));
    const ARS = (Array.isArray(RAW.ar_big) ? RAW.ar_big : arr(RAW.ar).filter(e => e && !Array.isArray(e))).map(e => norm(e, 'ar'));
    const EVENTS = FIRES.concat(ARS, arr(RAW.wind).map(e => norm(e, 'wind'))).filter(e => e && (e.band || (e.foot && Object.keys(e.foot).length)));
    const EVENT_BY_ID = {}; EVENTS.forEach(e => { EVENT_BY_ID[e.id] = e; });
    /* the event's measure at one ZIP row, or null when the event did not touch it */
    const at = (e, z) => e.foot ? (e.foot[z.zip] || null) : (e.band && isN(z.lat) && z.lat >= e.band[0] && z.lat <= e.band[1] ? {} : null);
    /* statewide evidence figures typed from the evidence file (roofing_law_evidence.md, read November 19, 2026); the data file's own value is used where it carries one */
    const L = META.lic || {};
    const licOK = isN(L.clear) && L.clear > 0;
    const EVD = { c39: licOK ? L.clear : 5602, c39_roll: licOK && isN(L.n) ? L.n : 5602, c39_out: licOK ? L.out : 154, c39_date: 'November 19, 2026', fair_pif: 698307, fair_date: 'September 2026', fair_up: 157,
      mh_med: (META.ahs || {}).w_mh_med, mh_region: 'the West' };
    /* regions: number -> two letter key and name come from the data (META.model.REGK, REG); the wording for running text is typed here */
    const REGIONS = [
      { key: 'nc', name: 'North Coast', the: 'the North Coast', counties: ['Del Norte', 'Humboldt', 'Mendocino', 'Lake'] },
      { key: 'fn', name: 'Far North', the: 'the Far North', counties: ['Siskiyou', 'Modoc', 'Shasta', 'Lassen', 'Tehama', 'Trinity', 'Plumas'] },
      { key: 'sv', name: 'Sacramento Valley', the: 'the Sacramento Valley', counties: ['Butte', 'Glenn', 'Colusa', 'Sutter', 'Yuba', 'Yolo', 'Sacramento', 'Placer', 'El Dorado'] },
      { key: 'si', name: 'Sierra', the: 'the Sierra', counties: ['Sierra', 'Nevada', 'Amador', 'Calaveras', 'Tuolumne', 'Mariposa', 'Alpine', 'Mono', 'Inyo'] },
      { key: 'ba', name: 'Bay Area', the: 'the Bay Area', counties: ['Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco', 'San Mateo', 'Santa Clara', 'Solano', 'Sonoma'] },
      { key: 'cc', name: 'Central Coast', the: 'the Central Coast', counties: ['Santa Cruz', 'San Benito', 'Monterey', 'San Luis Obispo', 'Santa Barbara'] },
      { key: 'sj', name: 'San Joaquin Valley', the: 'the San Joaquin Valley', counties: ['San Joaquin', 'Stanislaus', 'Merced', 'Madera', 'Fresno', 'Kings', 'Tulare', 'Kern'] },
      { key: 'la', name: 'Los Angeles and Ventura', the: 'Los Angeles and Ventura counties', counties: ['Los Angeles', 'Ventura'] },
      { key: 'oc', name: 'Orange County', the: 'Orange County', counties: ['Orange'] },
      { key: 'ie', name: 'Inland Empire', the: 'the Inland Empire', counties: ['Riverside', 'San Bernardino'] },
      { key: 'sd', name: 'San Diego and Imperial', the: 'San Diego and Imperial counties', counties: ['San Diego', 'Imperial'] }];
    const REGION_BY_KEY = {}; REGIONS.forEach(r => { REGION_BY_KEY[r.key] = r; });
    const REGK = ((META.model || {}).REGK) || {};
    const regionOfCounty = pa => { if (!pa) return null; const k = REGK[pa.reg]; return (k && REGION_BY_KEY[k]) || REGIONS.find(r => r.counties.includes(pa.name)) || null; };
    /* the default office point when no office is set: Sacramento, from the data when the city is in it */
    const DEFAULT_POINT = () => { const c = CITIES.find(x => x.name === 'Sacramento'); return c && isN(c.lat) ? [c.lat, c.lon] : [38.5816, -121.4944]; };
    /* printed source lines the data file may override (META.src rows keyed by k) */
    const srcOf = (k, d) => { const r = (META.src || []).find(x => x && x.k === k); return r && r.name ? r.name + (r.vintage ? ', ' + r.vintage : '') : d; };
    return { COUNTIES, COUNTY_BY_FIPS, countyOfIdx, zc, has, FHSZ_BASIS, fhsz, YRS, EVENTS, EVENT_BY_ID, at, EVD, REGIONS, REGION_BY_KEY, regionOfCounty, DEFAULT_POINT, srcOf };
  })();
  const CTY = HZ.COUNTIES, CTYI = HZ.COUNTY_BY_FIPS;

  /* ---------- statewide constants ---------- */
  const ST = (() => {
    const ts = DATA.ts || {}; const ppi = ts.ppi || {}; const last = a => a && a.length ? a[a.length - 1] : null;
    const yoyOf = a => { const L = last(a); if (!L) return null; const [y, m] = L[0].split('-'); const prev = (a || []).find(x => x[0] === (+y - 1) + '-' + m); return prev ? 100 * (L[1] / prev[1] - 1) : null; };
    const perm = ts.permits || {}; const pys = Object.keys(perm).map(Number).filter(isN); const py = pys.length ? Math.max(...pys) : null;
    const fy = (ts.fema_year || []).map(r => r[2]).filter(isN); const L = last(ppi.steel);
    return { steel: yoyOf(ppi.steel), ppiYM: L ? L[0] : null, permYear: py, permUnits: py != null ? (perm[py] || [])[1] : null,
      fema: sum(Z.map(z => HZ.zc(z, 'fema'))), fy0: fy.length ? Math.min(...fy) : 2003, fy1: fy.length ? Math.max(...fy) : CUR, events: HZ.EVENTS.length };
  })();

  /* ---------- the event ledger at a set of ZIP rows ---------- */
  const zrows = ms => ms && ms.length ? ms.flatMap(c => c.zips || []).filter((v, i, a) => a.indexOf(v) === i).map(z => ZI[z]).filter(Boolean) : null;
  function evStats(e, zs) {
    let n = 0, dest = 0, dmg = 0, hu = 0, roofs = 0, gust = 0;
    (zs || Z).forEach(z => { const m = HZ.at(e, z); if (!m) return; if (e.kind === 'fire' && !(m.pct > 0 || m.dest || m.dmg)) return; n++; dest += m.dest || 0; dmg += m.dmg || 0; hu += HZ.zc(z, 'hu') || 0; roofs += z.roofs || 0; if (m.gust > gust) gust = m.gust; });
    const score = e.kind === 'fire' ? (dest + dmg) + (n ? 0.001 * (e.acres || 0) : 0) : (e.rank || 1) * hu / 1000;
    return { n, dest, dmg, hu, roofs, gust: gust || e.gust || null, est: dest + dmg, score };
  }
  const eventLocal = (id, ms) => { const e = HZ.EVENT_BY_ID[id]; return e ? evStats(e, zrows(ms)) : { n: 0, dest: 0, dmg: 0, hu: 0, roofs: 0, gust: null, est: 0, score: 0 }; };
  function eventOptions(ms) { const zs = zrows(ms); return HZ.EVENTS.map(e => [e, evStats(e, zs).score]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || b[0].year - a[0].year).slice(0, 12).map(x => x[0]); }
  const eventAge = e => CUR - e.year;
  /* recent events: damage that may still be on the roofs; wave fires: the homes rebuilt after them have roofs of one age */
  const angleOf = e => { const a = eventAge(e); return a <= 1 ? 'fresh' : a <= 6 ? 'recent' : e.kind === 'fire' && a >= 13 && a <= 24 ? 'wave' : 'past'; };
  function chosenEvents(cfg, ms) {
    const B = cfg.build; if (!B.eventsAuto) return (B.events || []).filter(id => HZ.EVENT_BY_ID[id]);
    const opts = eventOptions(ms); const out = []; const take = e => { if (e && !out.includes(e.id) && out.length < 2) out.push(e.id); }; const now = e => angleOf(e) === 'fresh' || angleOf(e) === 'recent';
    take(opts.find(e => e.kind === 'fire' && now(e) && eventLocal(e.id, ms).est >= 10)); take(opts.find(e => e.kind !== 'fire' && now(e))); take(opts.find(e => angleOf(e) === 'wave'));
    return out;
  }
  function eventCityRows(id, ms) {
    const e = HZ.EVENT_BY_ID[id]; if (!e) return []; const list = ms && ms.length ? ms : CITIES.filter(c => (c.pop || 0) >= 10000);
    return list.map(c => { const s = evStats(e, (c.zips || []).map(z => ZI[z]).filter(Boolean)); return Object.assign({ c }, s, { ra20: sum((c.zips || []).map(z => (ZI[z] || {}).ra20)) }); }).filter(x => x.n > 0).sort((a, b) => b.est - a.est || b.hu - a.hu);
  }
  function eventsAt(zs) { return HZ.EVENTS.map(e => [e, evStats(e, zs)]).filter(x => x[1].n > 0 && (x[0].kind !== 'fire' || x[1].est > 0 || x[0].dest == null)).sort((a, b) => b[0].year - a[0].year || b[1].score - a[1].score); }
  const KINDL = { fire: 'Wildfire', ar: 'Atmospheric river', wind: 'Wind' };

  /* ---------- sentences from the hazard columns (each is blank when its column is not in the data) ---------- */
  const pctW = v => v < 1 ? 'Less than 1 percent' : 'About ' + P(v, 0);
  function hazSentence(fx, where) {
    const out = [];
    if (isN(fx.fhsz)) out.push(`${pctW(fx.fhsz)} ${HZ.FHSZ_BASIS} in ${where} is mapped as a High or Very High Fire Hazard Severity Zone.`);
    if (isN(fx.fire_dest) || isN(fx.fire_dmg)) { const d = fx.fire_dest || 0, m = fx.fire_dmg || 0;
      out.push(d + m > 0 ? `CAL FIRE damage inspections record ${N(d)} ${d === 1 ? 'structure' : 'structures'} destroyed and ${N(m)} damaged by wildfire there from ${HZ.YRS.dins0} to ${HZ.YRS.dins1}${fx.fire_worst ? `, most of them in the ${fx.fire_worst} of ${fx.fire_worst_yr}` : ''}.` : `CAL FIRE damage inspections from ${HZ.YRS.dins0} to ${HZ.YRS.dins1} record no structures destroyed or damaged by wildfire there.`); }
    return out.join(' ');
  }
  function windSentence(fx, where) {
    if (!isN(fx.g58)) return '';
    return (fx.g58 >= 0.1 ? `Gusts of 58 mph or more are measured near ${where} on about ${D(fx.g58, 1)} days a year` : `Gusts of 58 mph or more are rare at the weather stations nearest ${where}`) + (isN(fx.gust_max) && fx.gust_max >= 40 ? `, and the highest gust on the station record is ${N(fx.gust_max)} mph.` : '.');
  }
  function rainSentence(fx, where) {
    const out = [];
    if (isN(fx.rain_in)) out.push(`Normal rainfall in ${where} is about ${D(fx.rain_in, fx.rain_in < 10 ? 1 : 0)} inches a year, most of it from November to March.`);
    if (isN(fx.ar_d) && fx.ar_d >= 1) out.push(`Atmospheric rivers make landfall at its latitude on about ${D(fx.ar_d, 0)} days a year.`);
    if (isN(fx.snow_psf) && fx.snow_psf >= 20) out.push(`Design ground snow loads there reach about ${N(fx.snow_psf)} pounds per square foot.`);
    return out.join(' ');
  }
  /* the house reroof rule of the Energy Code by climate zone: steep slope in zones 4 and 8 to 15, low slope in 4 and 6 to 15 (150.2(b)1I) */
  const coolSteep = z => z === 4 || (z >= 8 && z <= 15), coolLow = z => z === 4 || (z >= 6 && z <= 15);
  function coolSentence(fx, where) {
    const zs = fx.czs || []; if (!zs.length) return '';
    if (zs.length > 1) return `${cap1(where)} span energy climate zones ${listAnd(zs.map(String))}, and the cool roof rule differs between them.`;
    const z = zs[0]; const s = coolSteep(z), l = coolLow(z);
    return `${cap1(where)} are in energy climate zone ${z}, where the cool roof rule ` + (s && l ? 'applies to steep and low slope house reroofs of more than half the roof.' : l ? 'applies to low slope house reroofs of more than half the roof and not to steep slope ones.' : 'does not apply to house reroofs.');
  }
  const fairSentence = (fx, where) => isN(fx.fair_pif) && fx.fair_pif > 0 ? `The FAIR Plan had ${N(fx.fair_pif)} residential ${fx.fair_pif === 1 ? 'policy' : 'policies'} in force in ${where} on ${HZ.YRS.fairDate}${isN(fx.fair_pif22) && fx.fair_pif22 >= 10 && fx.fair_pif22 < fx.fair_pif ? `, up from ${N(fx.fair_pif22)} in ${HZ.YRS.fair0}` : ''}.` : '';
  const femaSentence = (n, where) => n > 0 ? `FEMA recorded ${N(n)} household ${n === 1 ? 'registration' : 'registrations'} with roof or real property damage in ${where} in the disasters of ${ST.fy0} to ${ST.fy1}. FEMA counts only people who applied for federal help, so the count understates the damage.` : '';

  /* ---------- places ---------- */
  function placeFx(zs) {
    const s = k => sum(zs.map(z => z[k]));
    const hs = k => HZ.has(k) ? sum(zs.map(z => HZ.zc(z, k))) : null;
    const wm = (f, w) => { let a = 0, t = 0; zs.forEach(z => { const v = f(z), ww = w(z); if (isN(v) && ww > 0) { a += v * ww; t += ww; } }); return t ? a / t : null; };
    const byPop = k => wm(z => HZ.zc(z, k), z => z.pop), mx = k => { const a = zs.map(z => HZ.zc(z, k)).filter(isN); return a.length ? Math.max(...a) : null; };
    const roofs = s('roofs'), ra20 = s('ra20');
    let worst = null; zs.forEach(z => { const n = HZ.zc(z, 'fire_worst_n'); if (isN(n) && n > 0 && (!worst || n > worst.n)) worst = { n, name: HZ.zc(z, 'fire_worst'), yr: HZ.zc(z, 'fire_worst_yr') }; });
    const czs = [...new Set(zs.map(z => HZ.zc(z, 'cz')).filter(isN).map(Number))].sort((a, b) => a - b);
    return { roofs, ra20, ra20_sh: roofs ? 100 * ra20 / roofs : null, wave: s('wave'), nxt: s('nxt'), mh: s('mh'), cru: s('cru'), hu: hs('hu'),
      fema: hs('fema') || 0, fema_fire: hs('fema_fire'), fema_storm: hs('fema_storm'), tile_n: hs('tile_n'), tile25: hs('tile25'), ra25: hs('ra25'),
      fhsz: wm(z => HZ.fhsz(z), z => HZ.zc(z, 'sqmi') || 1), fire_dest: hs('fire_dest'), fire_dmg: hs('fire_dmg'), fire_worst: worst && worst.name ? (/\b(fire|complex)$/i.test(worst.name) ? worst.name : worst.name + ' Fire') : null, fire_worst_yr: worst ? worst.yr : null, lastfire: mx('lastfire'),
      g58: byPop('g58'), gust_max: mx('gust_max'), ar_d: byPop('ar_d'), rain_in: byPop('rain_in'), h100: byPop('h100'), snow_psf: mx('snow_psf'), czs,
      fair_pif: hs('fair_pif'), fair_pif22: hs('fair_pif22'), span_sh: byPop('span_sh'), events: eventsAt(zs) };
  }
  function cityExtra(c) { if (!c._fx) c._fx = placeFx((c.zips || []).map(z => ZI[z]).filter(Boolean)); return c._fx; }
  function countyExtra(pa) { if (!pa._fx) pa._fx = placeFx(Z.filter(z => z.pi === pa.i)); return pa._fx; }
  const regionCounties = rg => CTY.filter(pa => HZ.regionOfCounty(pa) === rg);
  function regionExtra(rg) { if (!rg._fx) { const idx = new Set(regionCounties(rg).map(pa => pa.i)); rg._fx = placeFx(Z.filter(z => idx.has(z.pi))); } return rg._fx; }
  function office(cfg) {
    const S = cfg.site; const c = CITY[S.city] || null; let lat = null, lon = null;
    if (c) { lat = c.lat; lon = c.lon; } else if (S.zip && ZI[S.zip]) { lat = ZI[S.zip].lat; lon = ZI[S.zip].lon; } else if (isN(S.lat) && isN(S.lon)) { lat = +S.lat; lon = +S.lon; }
    if (!isN(lat) || !isN(lon)) { const d = HZ.DEFAULT_POINT(); lat = d[0]; lon = d[1]; }
    return { c, lat, lon, set: !!S.city };
  }
  function distMi(c, cfg) { const o = office(cfg); return isN(c.lat) ? kmLL(o.lat, o.lon, c.lat, c.lon) / 1.609344 : 999; }
  const pool = k => [LAB(k) + ' jobs a year (model)', c => c['p_' + k]];
  const METRICS = {
    fees: ['Gross profit pool a year, all lines (model)', c => c.fees], ra20: ['Roofs 20 years or older (model)', c => cityExtra(c).ra20], wave: ['Roofs reaching 20 within five years (model)', c => cityExtra(c).wave],
    replace: pool('replace'), repair: pool('repair'), storm: pool('storm'), fire: pool('fire'), harden: pool('harden'), tile: pool('tile'), solar: pool('solar'), metal: pool('metal'), mh: pool('mh'),
    comm: ['Commercial, multifamily and coating jobs a year (model)', c => (c.p_comm || 0) + (c.p_coat || 0) + (c.p_mf || 0)],
    fhsz: ['Land in High or Very High Fire Hazard Severity Zones, percent', c => cityExtra(c).fhsz], firedmg: [`Structures destroyed or damaged by wildfire, ${HZ.YRS.dins0} to ${HZ.YRS.dins1}`, c => (cityExtra(c).fire_dest || 0) + (cityExtra(c).fire_dmg || 0)],
    fair: ['FAIR Plan residential policies in force', c => cityExtra(c).fair_pif], fema: [`FEMA roof or property registrations, ${ST.fy0} to ${ST.fy1}`, c => cityExtra(c).fema],
    roofs: ['One unit roofs', c => cityExtra(c).roofs], pop: ['Residents of its ZIP codes', c => c.pop],
  };
  function markets(cfg) {
    const f = cfg.focus;
    if (f.scope === 'pick') return f.picks.map(n => CITY[n]).filter(Boolean);
    let list = CITIES.filter(c => (c.pop || 0) >= f.minPop);
    if (f.scope === 'radius') list = list.filter(c => distMi(c, cfg) <= f.miles);
    if (f.scope === 'county') list = list.filter(c => CTY[c.pi] && (f.counties || []).includes(CTY[c.pi].fips));
    if (f.scope === 'region') list = list.filter(c => { const rg = HZ.regionOfCounty(CTY[c.pi]); return rg && (f.regions || []).includes(rg.key); });
    const m = (METRICS[f.metric] || METRICS.fees)[1];
    const ranked = list.slice().sort((a, b) => (m(b) || 0) - (m(a) || 0)).slice(0, f.n);
    const home = CITY[cfg.site.city]; if (home && !ranked.includes(home) && list.includes(home)) ranked.push(home);
    return ranked;
  }
  const segOf = lines => ({ res: lines.some(k => RES_LINES.includes(k)), com: lines.some(k => COM_LINES.includes(k)) });
  const segText = lines => { const g = segOf(lines); return g.res && g.com ? 'homes and businesses' : g.com ? 'businesses and properties' : 'homes'; };

  function defaultCfg() {
    const b = BRAND; const firmSet = brandSet();
    const lines = ['replace', 'repair', 'storm', 'harden', 'tile', 'solar', 'metal'].filter(k => C.AC[k] && LINES.includes(k));
    return {
      v: 1,
      site: { brand: b.name || '', url: b.url || (b.domain ? 'https://www.' + b.domain : ''), cms: '', phone: b.phone ? phoneFmt(b.phone) : '', email: b.email || '',
        lic: b.lic || '', licClass: b.licClass || '', contact: b.contact || '', contactRole: 'Qualifying individual', contactBio: '', street: houseClean(String(b.street || '').replace(/\bSte\b\.?/i, 'Suite')), city: b.city || '', zip: b.zip || '', offices: b.offices || '', lat: b.lat, lon: b.lon,
        hours: houseClean(b.hours || ''), hoursEs: '', hoursSchema: '', warranty: b.warranty || '', financing: b.financing || '', certs: b.certs || '', harden: b.harden || '', privacy_url: '',
        entity: 'RoofingContractor', sameAs: Object.values(b.social || {}).filter(v => /^https?:/.test(String(v))).join(', '), primary: (b.colors || {}).primary || '#b0502a', accent: (b.colors || {}).accent || '#efc6ab', dark: (b.colors || {}).dark || '#1e2933', globals: true,
        font_heading: (b.fonts || {}).display || '', font_body: (b.fonts || {}).body || '', logo_url: b.logoUrl || '',
        form_provider: 'html', form_shortcode: '', cta_label: 'Book a roof inspection', cta_url: '#contact', template: 'default', trust: 'CSLB license {lic} | Office in {officeCity} | {hours}',
        about: '', video_url: '', testimonials: '', sticky: true, noindex_landing: true, guides_as_posts: false, span: 15, live: '', followBrand: true },
      focus: { scope: b.city ? 'radius' : 'all', miles: 45, counties: [], regions: [], picks: [], metric: 'fees', n: 8, minPop: 10000 },
      build: { home: true, about: true, practice: true, regions: false, counties: false, cities: true, eventPages: true, landing: true, es: /spanish|espa/i.test(b.languages || ''), guides: true,
        lines, landingLines: ['replace', 'repair'], eventsAuto: true, events: [], topics: ['age', 'storm', 'firezone', 'license'] },
      media: { assets: [], assign: {} }, edits: {}, removed: {}, _firm: firmSet,
    };
  }
  /* pull the company fields from the Company panel (BRAND); force overwrites, otherwise only fills from non empty values */
  function syncBrand(cfg, force) {
    const b = BRAND, s = cfg.site; const set = (k, v) => { if (v != null && v !== '' && (force || s[k] !== v)) s[k] = v; };
    set('brand', b.name); set('lic', b.lic); set('licClass', b.licClass); set('contact', b.contact); set('phone', b.phone ? phoneFmt(b.phone) : ''); set('email', b.email); set('url', b.url || (b.domain ? 'https://www.' + b.domain : ''));
    set('street', b.street ? houseClean(String(b.street).replace(/\bSte\b\.?/i, 'Suite')) : ''); set('city', b.city); set('zip', b.zip); set('offices', b.offices); set('hours', b.hours ? houseClean(b.hours) : '');
    set('warranty', b.warranty); set('financing', b.financing); set('certs', b.certs); set('harden', b.harden); set('logo_url', b.logoUrl);
    if (b.colors) { set('primary', b.colors.primary); set('accent', b.colors.accent); set('dark', b.colors.dark); }
    if (b.fonts) { set('font_heading', b.fonts.display); set('font_body', b.fonts.body); }
    if (isN(b.lat) && isN(b.lon)) { s.lat = b.lat; s.lon = b.lon; }
    return cfg;
  }

  /* ---------- template values ---------- */
  function baseVars(cfg, plan) {
    const S = cfg.site; const B = cfg.build; const E = HZ.EVD;
    const V = { brand: S.brand || PH.brand, lic: S.lic || PH.lic, phone: phoneFmt(S.phone), hours: S.hours || '', hoursEs: S.hoursEs || '', officeCity: S.city || PH.city, state: STATE, contact: S.contact || '' };
    V.officeAddr = S.street ? `${S.street}, ${V.officeCity}, ${STATE} ${S.zip || ''}`.trim() : `${V.officeCity}, ${STATE}`;
    const others = officeList(S).slice(1);
    V.officeLine = (S.street ? `Our office is at ${S.street}, ${V.officeCity}, ${STATE} ${S.zip || ''}`.trim() + '.' : `Our office is in ${V.officeCity}, ${STATE}.`) + (others.length ? ` We also have ${others.length === 1 ? 'an office' : 'offices'} in ${listAnd(others)}.` : '');
    V.areaList = listAnd((plan || []).slice(0, 6).map(c => c.name)) || STATE;
    const lines = (B.lines || LINES).filter(k => C.AC[k]);
    V.lineList = listAnd((lines.length ? lines : LINES).map(k => RUN[k] || lc(LAB(k))));
    V.segText = segText(lines.length ? lines : LINES);
    V.hoursShort = (S.hours || '').split(',')[0]; V.hoursRest = (S.hours || '').split(',').slice(1).join(',').trim();
    Object.assign(V, { s_ra20: about(META.ra20), s_wave: about(META.wave), s_nxt: about(META.nxt), s_mh: about(META.mh), s_roofs: about(META.roofs), s_fema: N(ST.fema),
      s_steelMove: isN(ST.steel) ? (ST.steel >= 0 ? 'rose ' : 'fell ') + P(Math.abs(ST.steel), 0) : null, s_ppiMonth: ymLong(ST.ppiYM), s_permits: isN(ST.permUnits) ? N(ST.permUnits) : null, s_permitYear: ST.permYear ? String(ST.permYear) : null,
      s_c39: N(E.c39), s_c39Date: E.c39_date, s_out: isN(E.c39_out) ? N(E.c39_out) : null, s_fair: N(E.fair_pif), s_fairDate: E.fair_date });
    return V;
  }
  function regionVars(rg, V, plan) {
    if (!rg) return V; const x = regionExtra(rg); const where = rg.the;
    V.region = rg.the; V.regionName = rg.name; V.rg_roofs = about(x.roofs); V.rg_ra20 = about(x.ra20); V.rg_wave = about(x.wave); V.rg_fema = N(x.fema);
    V.rg_fhsz = isN(x.fhsz) ? P(x.fhsz, 0) : null; V.rg_fire = isN(x.fire_dest) ? N((x.fire_dest || 0) + (x.fire_dmg || 0)) : null; V.rg_fair = isN(x.fair_pif) ? N(x.fair_pif) : null;
    V.rg_hazSentence = hazSentence(x, where); V.rg_windSentence = windSentence(x, where); V.rg_rainSentence = rainSentence(x, where);
    const cs = regionCounties(rg); V.rg_counties = cs.length === 1 ? `${cs[0].name} County` : listAnd(cs.map(c => c.name)) + ' counties';
    const idx = new Set(cs.map(c => c.i)); const inR = (plan || []).filter(c => idx.has(c.pi)).map(c => c.name); const top = CITIES.filter(c => idx.has(c.pi)).sort((a, b) => b.pop - a.pop).map(c => c.name);
    V.rg_cities = listAnd((inR.length ? inR : top).slice(0, 6)) || 'communities across the region';
    return V;
  }
  function countyVars(pa, V, plan) {
    if (!pa) return V; const px = countyExtra(pa); const where = `${pa.name} County`;
    V.county = pa.name; V.countyFull = `${pa.name} County`; V.co_roofs = about(px.roofs); V.co_ra20 = about(px.ra20); V.co_wave = about(px.wave); V.co_fema = N(px.fema);
    V.co_fhsz = isN(px.fhsz) ? P(px.fhsz, 0) : null; V.co_fire = isN(px.fire_dest) ? N((px.fire_dest || 0) + (px.fire_dmg || 0)) : null; V.co_fair = isN(px.fair_pif) ? N(px.fair_pif) : null; V.co_g58 = isN(px.g58) ? D(px.g58, 1) : null;
    V.co_hazSentence = hazSentence(px, where); V.co_windSentence = windSentence(px, where); V.co_rainSentence = rainSentence(px, where);
    V.co_fairSentence = fairSentence(px, where); V.co_femaSentence = femaSentence(px.fema, where);
    const inP = (plan || []).filter(c => c.pi === pa.i).map(c => c.name); const top = CITIES.filter(c => c.pi === pa.i).sort((a, b) => b.pop - a.pop).map(c => c.name);
    V.countyCities = listAnd((inP.length ? inP : top).slice(0, 6)) || `communities across ${pa.name} County`;
    regionVars(HZ.regionOfCounty(pa), V, plan);
    return V;
  }
  function cityVars(c, V, cfg, plan) {
    const x = cityExtra(c); const S = cfg.site; const here = S.city && S.city === c.name; const where = `the ${c.name} ZIP codes`;
    V.city = c.name; V.cityFull = c.name + ', ' + STATE;
    V.c_roofs = about(x.roofs); V.c_ra20 = about(x.ra20); V.c_ra20_sh = isN(x.ra20_sh) ? P(x.ra20_sh, 0) : null; V.c_wave = about(x.wave);
    V.c_fema = N(x.fema); V.c_fhsz = isN(x.fhsz) ? P(x.fhsz, 0) : null; V.c_fire = isN(x.fire_dest) || isN(x.fire_dmg) ? N((x.fire_dest || 0) + (x.fire_dmg || 0)) : null; V.c_g58 = isN(x.g58) && x.g58 >= 0.05 ? D(x.g58, 1) : null; V.c_fair = isN(x.fair_pif) ? N(x.fair_pif) : null;
    V.c_cz = x.czs.length ? listAnd(x.czs.map(String)) : null;
    V.c_hazSentence = hazSentence(x, where); V.c_windSentence = windSentence(x, where); V.c_rainSentence = rainSentence(x, where); V.c_coolSentence = coolSentence(x, where);
    V.c_fairSentence = fairSentence(x, where); V.c_femaSentence = femaSentence(x.fema, where);
    const across = V.county ? ` and across ${V.county} County` : '';
    V.cityServe = here ? `Yes. Our office is here in ${c.name}, and we work on ${V.segText || 'homes'} in ${c.name}${across}.` : `Yes. We work on ${V.segText || 'homes'} in ${c.name}${across} from our office in ${V.officeCity}.`;
    const near = (plan || []).filter(p => p.name !== c.name).map(p => [p, kmLL(c.lat, c.lon, p.lat, p.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(p => p[0].name);
    const near2 = near.length >= 2 ? near : CITIES.filter(p => p.name !== c.name && p.pop >= 10000).map(p => [p, kmLL(c.lat, c.lon, p.lat, p.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(p => p[0].name);
    V.nearby = listAnd(near2);
    return V;
  }
  function eventVars(e, V, plan) {
    if (!e) return V; const loc = eventLocal(e.id, plan); const rows = eventCityRows(e.id, plan);
    V.ev_name = e.name; V.ev_year = String(e.year); V.ev_month = MONTHS[(e.month || 1) - 1]; V.ev_when = e.when; V.ev_age = String(eventAge(e)); V.ev_kind = KINDL[e.kind] || 'Event';
    V.ev_acres = isN(e.acres) ? about(e.acres) : null; V.ev_dest = isN(e.dest) ? N(e.dest) : null; V.ev_dmg = isN(e.dmg) ? N(e.dmg) : null; V.ev_local = e.kind === 'fire' && loc.est ? N(loc.est) : null; V.ev_localAll = !!(V.ev_local && isN(e.dest) && loc.est >= (e.dest || 0) + (e.dmg || 0));   /* every inspected structure lies in the area's ZIP codes */
    V.ev_rank = isN(e.rank) ? 'AR' + e.rank : null; V.ev_gust = loc.gust ? N(loc.gust) : null; V.ev_hu = loc.hu ? about(loc.hu) : null; V.ev_at = e.at || null;
    V.ev_c0 = rows[0] ? rows[0].c.name : (V.officeCity !== PH.city ? V.officeCity : STATE); V.ev_c1 = rows[1] ? rows[1].c.name : '';
    V.ev_area = V.ev_c0 === STATE ? STATE : `${V.ev_c0}${V.ev_c1 ? ' and ' + V.ev_c1 : ''} area`;
    return V;
  }
  function varsFor(p, cfg, plan) {
    const V = baseVars(cfg, plan); const o = office(cfg);
    if (p.city && CITY[p.city]) { const c = CITY[p.city]; countyVars(CTY[c.pi], V, plan); cityVars(c, V, cfg, plan); }
    else if (p.fips && CTYI[p.fips]) { countyVars(CTYI[p.fips], V, plan); if (o.c) cityVars(o.c, V, cfg, plan); V.city = V.county + ' County'; V.cityFull = V.county + ' County, ' + STATE; }
    else if (p.reg && HZ.REGION_BY_KEY[p.reg]) { if (o.c) { countyVars(CTY[o.c.pi], V, plan); cityVars(o.c, V, cfg, plan); } regionVars(HZ.REGION_BY_KEY[p.reg], V, plan); V.city = V.region; V.cityFull = V.regionName + ', ' + STATE; }
    else { if (o.c) { countyVars(CTY[o.c.pi], V, plan); cityVars(o.c, V, cfg, plan); } else { V.city = V.officeCity; V.cityFull = V.officeCity + ', ' + STATE; } }
    if (p.event && HZ.EVENT_BY_ID[p.event]) eventVars(HZ.EVENT_BY_ID[p.event], V, plan);
    return V;
  }

  /* ---------- facts (public attribution on the page; the grade and the date stay in the forge) ----------
     Each row: [value, label as printed, source key or source text, grade A to D, date of the record or of the reading].
     Statewide figures are typed from the evidence file (roofing_law_evidence.md, every row read on November 19, 2026) or
     come from the data file; place figures come from the ZIP table through the seams above. */
  function factItem(k, V) {
    const Y = HZ.YRS; const READ = 'read November 19, 2026';
    const SRC = { model: HZ.srcOf('model', 'Estimate from Census American Community Survey 2020 to 2024 housing data and the 2023 American Housing Survey'),
      acs: 'U.S. Census Bureau, American Community Survey 2020 to 2024', fema: `OpenFEMA Individuals and Households Program, ${ST.fy0} to ${ST.fy1}`,
      nahb: 'National Association of Home Builders, Study of Life Expectancy of Home Components (2007)', nachi: 'International Association of Certified Home Inspectors, life expectancy chart (a guideline table, national)',
      recs: 'U.S. Energy Information Administration, 2020 Residential Energy Consumption Survey, California households (occupant reported)',
      ahs: 'U.S. Census Bureau, American Housing Survey 2023', bls: 'U.S. Bureau of Labor Statistics, Producer Price Index for steel mill products', bps: 'U.S. Census Bureau, Building Permits Survey',
      cslb: 'Contractors State License Board, list by classification, C-39', fairp: 'California FAIR Plan Association, key statistics', fairz: 'California FAIR Plan Association, policies in force by ZIP code',
      fhsz: 'CAL FIRE Fire Hazard Severity Zone maps (State Responsibility Area 2024, Local Responsibility Area 2025), overlaid on ZIP code areas', dins: `CAL FIRE damage inspection records, ${Y.dins0} to ${Y.dins1}`,
      calfire: 'CAL FIRE incident records', ibhs: 'Insurance Institute for Business and Home Safety, The 2025 LA Conflagrations', gust: 'Airport weather station daily peak gusts, nearest long record station',
      noaa: 'NOAA Storm Events Database, California', cw3e: 'Center for Western Weather and Water Extremes, atmospheric river landfall catalog', lacity: 'City of Los Angeles open data, building permits issued',
      wui: '2025 California Wildland Urban Interface Code (Title 24, Part 7)', t24: '2025 Building Energy Efficiency Standards (Title 24, Part 6)', lac: 'Los Angeles County Building Code Manual 1512 Article 1 (April 1, 2025)',
      brown: 'Carl A. Brown, Lifetime Tile Roofs: Fact or Fiction (2012), a reserve study consultant', mfr: 'Published warranty terms of two metal panel makers (MBCI 2023, Drexel Metals 2020)' };
    const ab = v => v ? 'About ' + v : null; const E = HZ.EVD;
    const R = {
      /* the roof stock */
      s_ra20: [ab(V.s_ra20), `one unit roofs in ${STATE} are 20 years or older`, 'model', 'B', String(CUR)], s_wave: [ab(V.s_wave), `more ${STATE} roofs reach 20 years old within five years`, 'model', 'B', String(CUR)],
      s_nxt: [ab(V.s_nxt), `${STATE} roofs due for replacement from age alone in the coming year, tile relays aside`, 'model', 'B', String(CUR)],
      s_mh: [ab(V.s_mh), `mobile and manufactured homes in ${STATE}`, 'acs', 'A', '2020 to 2024'],
      shingle_fact: ['62 percent', `of ${STATE} single family homes have composition shingle roofs`, 'recs', 'B', '2020'],
      tilestock_fact: ['27 percent', `of ${STATE} single family homes have clay or concrete tile roofs, against 7 percent nationally`, 'recs', 'B', '2020'],
      tile8099_fact: ['43 percent', `of ${STATE} single family homes built from 1980 to 1999 have tile roofs`, 'recs', 'B', '2020'],
      metalstock_fact: ['2.2 percent', `of ${STATE} single family homes have metal roofs, against 7.3 percent nationally`, 'recs', 'B', '2020'],
      life_fact: ['About 20 years', 'life of an asphalt shingle roof in a national study; no field study gives a California figure', 'nahb', 'B', '2007'],
      life_metal: ['40 to 80 years', 'guideline life of a metal roof nationally, depending on the metal, the finish and salt exposure', 'nachi', 'C', READ],
      life_comm: ['15 to 30 years', 'guideline life of a low slope membrane nationally, by type, thickness and drainage', 'nachi', 'C', READ],
      tile_fact: ['About 25 years', 'planning life of standard underlayment under a tile roof, by one reserve study consultant; the tile usually outlasts it', 'brown', 'C', '2012'],
      salt_fact: ['1,000 to 2,800 feet', 'distance from salt water inside which two metal panel makers limit or exclude their finish and perforation warranties', 'mfr', 'C', '2020 and 2023'],
      mh_cost: [isN(E.mh_med) ? 'About ' + M$(E.mh_med) : null, `median cost of a professional roof job on a manufactured home in ${E.mh_region}`, 'ahs', 'B', '2023'],
      /* licensing and contracts */
      lic_fact: ['$1,000', 'total job price at which a contractor license is required; below it a license is still needed when the work needs a permit or the contractor has employees', 'Bus. & Prof. Code 7048 (AB 2622)', 'A', 'in force January 1, 2025'],
      bond_fact: ['$25,000', 'contractor\'s bond every licensee keeps on file with the Contractors State License Board', 'Bus. & Prof. Code 7071.6', 'A', 'in force January 1, 2023'],
      wc_fact: ['Required', 'workers compensation insurance for every C-39 roofing licensee, with or without employees', 'Bus. & Prof. Code 7125', 'A', READ],
      down_fact: ['$1,000 or 10 percent', 'largest down payment allowed on a home improvement contract, whichever is less', 'Bus. & Prof. Code 7159.5', 'A', READ],
      cancel_fact: ['3 business days', 'to cancel a home improvement contract after receiving the signed copy; 5 for a senior citizen and 7 for repairs after a declared emergency', 'Bus. & Prof. Code 7159; Civ. Code 1689.6', 'A', READ],
      c39_fact: [N(E.c39), `active C-39 Roofing licenses on the Contractors State License Board file, ${E.c39_date}`, 'cslb', 'A', E.c39_date],
      s_out: [V.s_out, `of the ${N(E.c39_roll)} C-39 licenses on the board's roll list an address outside California`, 'cslb', 'B', E.c39_date],
      lien_fact: ['20 days', 'for a subcontractor or supplier to give preliminary notice after first furnishing work, on which a mechanics lien depends', 'Civ. Code 8200, 8204', 'A', READ],
      sb800_fact: ['January 1, 2003', 'homes sold on or after this date fall under the Right to Repair Act, whose standards say a roof must not let water into the structure', 'Civ. Code 896, 938', 'A', READ],
      repose_fact: ['10 years', 'outer limit for claims over hidden construction defects, from substantial completion; 4 years for visible defects', 'Code Civ. Proc. 337.15, 337.1', 'A', READ],
      /* insurance rules */
      clock_fact: ['15, 40 and 30 days', 'for an insurer to acknowledge a claim, to accept or deny it after proof of claim, and to pay after accepting it', 'Cal. Code Regs. tit. 10, 2695.5 and 2695.7', 'A', READ],
      rcv_fact: ['12 months', 'least time an insurer may allow to collect full replacement cost; 36 months after a loss in a declared state of emergency', 'Ins. Code 2051.5', 'A', READ],
      ded_fact: ['Unlawful', 'for a contractor to offer or give a price reduction meant to offset an insurance deductible, unless the insurer has already set the claim amount', 'Penal Code 551', 'A', READ],
      gouge_fact: ['10 percent', 'most a contractor may raise repair prices for 180 days after an emergency is declared, apart from documented cost increases', 'Penal Code 396', 'A', READ],
      nonrenew_fact: ['75 days', 'least notice an insurer must give before declining to renew a residential policy', 'Ins. Code 678', 'A', READ],
      moratorium_fact: ['1 year', 'after a declared wildfire emergency during which insurers may not cancel or refuse to renew residential policies in ZIP codes in or next to the fire perimeter solely for wildfire risk', 'Ins. Code 675.1', 'A', READ],
      safer_fact: ['No set percentage', 'in the Safer from Wildfires rule for a Class A roof: insurers that price on wildfire risk must reflect it, and each files its own figure', 'Cal. Code Regs. tit. 10, 2644.9; California Department of Insurance, September 2026', 'A', 'September 2026'],
      fair_fact: [N(E.fair_pif), `FAIR Plan policies in force in ${E.fair_date}, up ${E.fair_up} percent since September 2022`, 'fairp', 'A', E.fair_date],
      fairdisc_fact: ['Up to 16.4 percent', 'off the wildfire part of a FAIR Plan dwelling premium when all 12 of its listed hardening measures are in place; a Class A roof is one, and no figure is published for the roof alone', 'California FAIR Plan, Wildfire Hardening Discounts (November 2025)', 'A', 'November 2025'],
      /* fire */
      classA_fact: ['Class A', 'roof assembly required in fire zones for new roofs and when 50 percent or more of a roof is replaced within 12 months', 'wui', 'A', 'in force January 1, 2026'],
      vent_fact: ['1/16 to 1/8 inch', 'openings of the metal mesh allowed on vents in fire zones, in place of a listed flame and ember resistant vent', 'wui', 'A', 'in force January 1, 2026'],
      fire_fact: ['16,264', 'structures destroyed in the Palisades and Eaton fires of January 2025, by the final counts', 'calfire', 'A', '2025'],
      roof90_fact: ['About 90 percent', 'of structures inside the Palisades and Eaton fire perimeters had Class A roof coverings', 'ibhs', 'A', '2025'],
      ventgap_fact: ['10.3 and 6.4 percent', 'of assessed structures in the Palisades and Eaton fire areas had vent screens of 1/8 inch or finer', 'ibhs', 'A', '2025'],
      harden_fact: ['54 percent', 'chance of no damage for homes with four hardening features in those fires, against 36 percent with one or two', 'ibhs', 'B', '2025'],
      /* weather */
      wind_fact: ['7,173', `high wind events logged for ${STATE}, 1996 to 2026`, 'noaa', 'B', '1996 to 2026'],
      santaana_fact: ['$60 million', 'property damage reported in the Santa Ana wind event of October 21, 2007 across the Inland Empire, San Diego County and the Orange County coast, with gusts over 70 mph', 'noaa', 'B', '2007'],
      hail_fact: ['349', `reports of hail one inch or larger anywhere in ${STATE} since 1951`, 'noaa', 'B', '1951 to 2026'],
      permits_la_fact: ['14,511', 'reroof permits issued by the City of Los Angeles in 2023, up 40 percent on 2022 after the wet winter', 'lacity', 'B', 'queried November 19, 2026'],
      /* energy code and solar */
      cool_fact: ['0.20', 'least aged solar reflectance for a steep slope house reroof in climate zones 4 and 8 to 15, when more than half the roof is replaced', 't24', 'A', 'in force January 1, 2026'],
      coollow_fact: ['0.63', 'least aged solar reflectance for a low slope reroof: houses in climate zones 4 and 6 to 15, nonresidential buildings in all 16', 't24', 'A', 'in force January 1, 2026'],
      cooltrig_fact: ['50 percent or 2,000 square feet', 'of roof replaced, recovered or recoated, whichever is less, brings the cool roof rule into play on multifamily and nonresidential buildings', 't24', 'A', 'in force January 1, 2026'],
      heavy_fact: ['25 pounds per square foot', 'roof weight at and above which the cool roof reflectance rule does not apply', 't24', 'A', 'in force January 1, 2026'],
      crrc_fact: ['0.08', 'aged reflectance the code assumes for an asphalt shingle with no Cool Roof Rating Council rating', 't24', 'A', 'in force January 1, 2026'],
      coatage_fact: ['0.65', 'factor the code applies to a field applied coating when it works out an aged reflectance from an initial one, against 0.70 for other products', 't24', 'A', 'in force January 1, 2026'],
      mandate_fact: ['January 1, 2020', 'date from which every new single family home has had to be built with a photovoltaic system', 't24', 'A', READ],
      solar_fact: ['Two permits', 'in unincorporated Los Angeles County when panels come off for a reroof: the reroof permit and a solar permit to put them back', 'lac', 'A', 'April 1, 2025'],
      solarlic_fact: ['C-10 or C-46', 'license class Los Angeles County names for removing and reinstalling solar panels; C-39 for the roof, or an A or B licensee for both', 'lac', 'A', 'April 1, 2025'],
      /* markets and prices */
      s_steel_fact: [isN(ST.steel) ? (ST.steel >= 0 ? 'Up ' : 'Down ') + P(Math.abs(ST.steel), 0) : null, `producer prices for steel mill products, the metal in roof panels and flashing, ${V.s_ppiMonth} against a year earlier`, 'bls', 'A', V.s_ppiMonth],
      s_permits_fact: [V.s_permits, `new housing units permitted in ${STATE} in ${V.s_permitYear}`, 'bps', 'A', V.s_permitYear],
      s_fema: [V.s_fema, `FEMA household registrations in ${STATE} with roof or real property damage, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A', `${ST.fy0} to ${ST.fy1}`],
      /* a city (its ZIP codes) */
      c_roofs: [ab(V.c_roofs), `one unit roofs in the ${V.city} ZIP codes`, 'acs', 'A', '2020 to 2024'], c_ra20: [ab(V.c_ra20), `one unit roofs in the ${V.city} ZIP codes are 20 years or older`, 'model', 'B', String(CUR)],
      c_fhsz: [V.c_fhsz, `${HZ.FHSZ_BASIS} in the ${V.city} ZIP codes is mapped as a High or Very High Fire Hazard Severity Zone`, 'fhsz', 'B', '2024 and 2025 maps'],
      c_fire: [V.c_fire, `structures destroyed or damaged by wildfire in the ${V.city} ZIP codes, ${Y.dins0} to ${Y.dins1}`, 'dins', 'A', `${Y.dins0} to ${Y.dins1}`],
      c_gust: [V.c_g58, `days a year with a gust of 58 mph or more measured near ${V.city}`, 'gust', 'B', 'station record'],
      c_fair: [V.c_fair, `FAIR Plan residential policies in force in the ${V.city} ZIP codes, ${Y.fairDate}`, 'fairz', 'A', Y.fairDate],
      c_fema: [V.c_fema, `FEMA household registrations with roof or real property damage in the ${V.city} ZIP codes, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A', `${ST.fy0} to ${ST.fy1}`],
      c_cz: [V.c_cz, `energy climate zone of the ${V.city} ZIP codes, which sets the cool roof rule for a reroof`, 't24', 'A', READ],
      /* a county */
      co_roofs: [ab(V.co_roofs), `one unit roofs in ${V.county} County`, 'acs', 'A', '2020 to 2024'], co_ra20: [ab(V.co_ra20), `one unit roofs in ${V.county} County are 20 years or older`, 'model', 'B', String(CUR)],
      co_fhsz: [V.co_fhsz, `${HZ.FHSZ_BASIS} in ${V.county} County ZIP codes is mapped as a High or Very High Fire Hazard Severity Zone`, 'fhsz', 'B', '2024 and 2025 maps'],
      co_fire: [V.co_fire, `structures destroyed or damaged by wildfire in ${V.county} County, ${Y.dins0} to ${Y.dins1}`, 'dins', 'A', `${Y.dins0} to ${Y.dins1}`],
      co_gust: [V.co_g58, `days a year with a gust of 58 mph or more measured near the county's communities, weighted by residents`, 'gust', 'B', 'station record'],
      co_fair: [V.co_fair, `FAIR Plan residential policies in force in ${V.county} County ZIP codes, ${Y.fairDate}`, 'fairz', 'A', Y.fairDate],
      co_fema: [V.co_fema, `FEMA household registrations with roof or real property damage in ${V.county} County, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A', `${ST.fy0} to ${ST.fy1}`],
      /* a region */
      rg_roofs: [ab(V.rg_roofs), `one unit roofs in ${V.region}`, 'acs', 'A', '2020 to 2024'], rg_ra20: [ab(V.rg_ra20), `one unit roofs in ${V.region} are 20 years or older`, 'model', 'B', String(CUR)],
      rg_fhsz: [V.rg_fhsz, `${HZ.FHSZ_BASIS} in ${V.region} is mapped as a High or Very High Fire Hazard Severity Zone`, 'fhsz', 'B', '2024 and 2025 maps'],
      rg_fire: [V.rg_fire, `structures destroyed or damaged by wildfire in ${V.region}, ${Y.dins0} to ${Y.dins1}`, 'dins', 'A', `${Y.dins0} to ${Y.dins1}`],
      rg_fair: [V.rg_fair, `FAIR Plan residential policies in force in ${V.region}, ${Y.fairDate}`, 'fairz', 'A', Y.fairDate],
      rg_fema: [V.rg_fema, `FEMA household registrations with roof or real property damage in ${V.region}, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A', `${ST.fy0} to ${ST.fy1}`],
      /* an event from the ledger */
      ev_dest: [V.ev_dest, `structures destroyed in the ${V.ev_name}, ${V.ev_when}`, 'dins', 'A', V.ev_year], ev_dmg: [V.ev_dmg, `structures damaged in the ${V.ev_name}`, 'dins', 'A', V.ev_year],
      ev_local: [V.ev_local, `structures destroyed or damaged by the ${V.ev_name} in the ZIP codes of the ${V.ev_area}`, 'dins', 'A', V.ev_year],
      ev_acres: [ab(V.ev_acres), `acres inside the perimeter of the ${V.ev_name}`, 'CAL FIRE fire perimeters', 'A', V.ev_year],
      ev_rank: [V.ev_rank, `strength of the ${V.ev_name} at landfall on the five step atmospheric river scale`, 'cw3e', 'A', V.ev_year],
      ev_gust: [V.ev_gust ? V.ev_gust + ' mph' : null, `highest gust reported in the ${V.ev_name}`, 'noaa', 'B', V.ev_year],
      ev_hu: [ab(V.ev_hu), `homes in the ZIP codes of the ${V.ev_area} that the ${V.ev_name} reached`, 'acs', 'B', '2020 to 2024'],
    };
    const r = R[k]; if (!r || r[0] == null || r[0] === '—' || r[0] === '' || r[0] === '0' || /undefined|null|NaN/.test(String(r[0]) + r[1])) return null;
    return { key: k, value: String(r[0]), label: r[1], source: SRC[r[2]] || r[2], grade: r[3], date: r[4] || '' };
  }
  const FACT_KEYS = ['s_ra20', 's_wave', 's_nxt', 's_mh', 'shingle_fact', 'tilestock_fact', 'tile8099_fact', 'metalstock_fact', 'life_fact', 'life_metal', 'life_comm', 'tile_fact', 'salt_fact', 'mh_cost', 'lic_fact', 'bond_fact', 'wc_fact', 'down_fact', 'cancel_fact', 'c39_fact', 's_out', 'lien_fact', 'sb800_fact', 'repose_fact',
    'clock_fact', 'rcv_fact', 'ded_fact', 'gouge_fact', 'nonrenew_fact', 'moratorium_fact', 'safer_fact', 'fair_fact', 'fairdisc_fact', 'classA_fact', 'vent_fact', 'fire_fact', 'roof90_fact', 'ventgap_fact', 'harden_fact', 'wind_fact', 'santaana_fact', 'hail_fact', 'permits_la_fact',
    'cool_fact', 'coollow_fact', 'cooltrig_fact', 'heavy_fact', 'crrc_fact', 'coatage_fact', 'mandate_fact', 'solar_fact', 'solarlic_fact', 's_steel_fact', 's_permits_fact', 's_fema'];

  /* ---------- plan ---------- */
  function plan(cfg) {
    const pages = []; const B = cfg.build; const ms = markets(cfg); const fipsOf = c => CTY[c.pi] ? CTY[c.pi].fips : '';
    const add = (kind, o) => { const p = Object.assign({ kind, lang: 'en' }, o); p.id = [kind, p.line || '', p.city || '', p.fips || '', p.event || '', p.topic || '', p.lang].concat(p.reg ? [p.reg] : []).join('|'); pages.push(p); return p; };
    if (B.home) add('home', {});
    if (B.about) add('about', {});
    if (B.practice) (B.lines || []).filter(k => C.AC[k]).forEach(k => add('practice', { line: k }));
    const fipsIn = [...new Set(ms.map(fipsOf).filter(Boolean))];
    if (B.regions) [...new Set(ms.map(c => HZ.regionOfCounty(CTY[c.pi])).filter(Boolean))].forEach(rg => add('region', { reg: rg.key }));
    if (B.counties) fipsIn.forEach(f => add('county', { fips: f }));
    if (B.cities) ms.forEach(c => add('city', { city: c.name, fips: fipsOf(c) }));
    const events = chosenEvents(cfg, ms);
    if (B.eventPages) events.forEach(id => add('event', { event: id }));
    if (B.landing) ms.forEach(c => (B.landingLines || []).filter(k => C.AC[k]).forEach(k => { add('landing', { line: k, city: c.name, fips: fipsOf(c) }); if (B.es && (cityExtra(c).span_sh || 0) >= (+cfg.site.span || 15)) add('landing', { line: k, city: c.name, fips: fipsOf(c), lang: 'es' }); }));
    if (B.guides) { const G = C.GUIDES.filter(g => (B.topics || []).includes(g.id));
      G.filter(g => g.scope === 'state').forEach(g => add('guide', { topic: g.id }));
      G.filter(g => g.scope === 'city').forEach(g => ms.forEach(c => add('guide', { topic: g.id, city: c.name, fips: fipsOf(c) }))); }
    const seen = {}; pages.forEach(p => { Object.assign(p, describe(p, cfg, ms)); if (cfg.edits[p.id]) Object.assign(p, cfg.edits[p.id]); let s = p.slug, n = 2; while (seen[s]) s = p.slug + '-' + (n++); seen[s] = 1; p.slug = s; });
    return { pages: pages.filter(p => !cfg.removed[p.id]), removed: pages.filter(p => cfg.removed[p.id]), markets: ms, events, storms: events };
  }
  function fitMeta(s) { s = houseClean(s); if (s.length <= 158) return s; const cut = s.slice(0, 158); const i = cut.lastIndexOf('. '); return i >= 60 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, '') + '…'; }
  function fitTitle(t, brand) { t = houseClean(t); if (t.length > 60) t = t.replace(' | ' + houseClean(brand), ''); if (t.length > 60) t = t.replace(/\s[|:].*$/, ''); if (t.length > 60) t = t.slice(0, 60).replace(/\s\S*$/, ''); return t; }
  function describe(p, cfg, ms) {
    const V = varsFor(p, cfg, ms); const brand = V.brand; const d = {};
    switch (p.kind) {
      case 'home': d.label = 'Home'; d.slug = 'home'; d.h1 = `Roofing Contractor in ${V.officeCity}, ${STATE}`; d.title = `${brand} | Roofing in ${V.officeCity}, ${ST2}`; d.meta = `Licensed roofing contractor in ${V.officeCity}, ${STATE}, for ${V.segText}: itemized written estimates and contracts that follow state law. ${brand}, CSLB license ${V.lic}.`; break;
      case 'about': d.label = 'About'; d.slug = 'about'; d.h1 = `About ${brand}`; d.title = `About ${brand} | ${STATE} Roofing Contractor`; d.meta = `${brand} is a ${STATE} roofing contractor with an office in ${V.officeCity}, CSLB license ${V.lic}. Who we are, how we work and how to check our license.`; break;
      case 'practice': { const A = C.AC[p.line]; d.label = LAB(p.line); d.slug = A.slug; d.h1 = A.h1n; d.title = `${A.title} | ${brand}`; d.meta = fill(A.meta || A.lede, V); break; }
      case 'region': d.label = V.regionName; d.slug = slug(V.regionName) + '-roofing'; d.h1 = `Roofing in ${cap1(V.region)}`; d.title = `${V.regionName} Roofing | ${brand}`; d.meta = `Roofing for ${V.segText} in ${V.region}, where about ${V.rg_ra20 || 'a share of the'} roofs are 20 years or older by our estimate. Office in ${V.officeCity}, ${STATE}.`; break;
      case 'county': d.label = `${V.county} County`; d.slug = slug(V.county) + '-county-roofing'; d.h1 = `Roofing in ${V.county} County, ${STATE}`; d.title = `${V.county} County Roofing | ${brand}`; d.meta = `Roofing for ${V.segText} in ${V.county} County, where about ${V.co_ra20 || 'a share of the'} roofs are 20 years or older by our estimate. Office in ${V.officeCity}, ${STATE}.`; break;
      case 'city': d.label = V.cityFull; d.slug = slug(V.city) + '-roofing'; d.h1 = `Roofing Contractor in ${V.city}, ${STATE}`; d.title = `${V.city} Roofing Contractor | ${brand}`; d.meta = `Roofing for ${V.segText} in ${V.city}${V.county ? ` and across ${V.county} County` : ''}, with itemized written estimates and contracts that follow state law. Office in ${V.officeCity}.`; break;
      case 'event': { const e = HZ.EVENT_BY_ID[p.event]; const fire = e.kind === 'fire'; const what = fire ? 'Roofs After the' : 'Roof Damage From the'; d.label = e.label; d.slug = slug(`${e.name} ${e.year} roofs ${V.ev_c0 === STATE ? '' : V.ev_c0}`);
        const h = `${what} ${cap1(V.ev_name)} in ${V.ev_c0}${V.ev_c1 ? ' and ' + V.ev_c1 : ''}`; d.h1 = h.length <= 70 ? h : `${what} ${cap1(V.ev_name)}`; d.title = `${cap1(V.ev_name)} and Your Roof | ${V.ev_c0}${V.ev_c0 === STATE ? '' : ', ' + ST2}`;
        const ang = angleOf(e); d.meta = ang === 'wave' ? `Homes rebuilt after the ${V.ev_name} of ${e.year} have roofs about ${V.ev_age} years old now. What that means in the ${V.ev_area} and what owners should check.` : fire ? `What the ${V.ev_name} of ${V.ev_when} did in the ${V.ev_area}, what a roof needs after a wildfire and the rules that protect owners who repair or rebuild.` : `What the ${V.ev_name} did to roofs in the ${V.ev_area}, the damage that can still be hiding, and what owners should check now.`; break; }
      case 'landing': { const A = C.AC[p.line], L = PLI[p.line] || { short: LAB(p.line) }, es = p.lang === 'es'; d.label = (es ? 'Spanish landing · ' : 'Landing · ') + L.short + ' · ' + V.city; d.slug = (es ? 'lp-es-' : 'lp-') + slug(L.short) + '-' + slug(V.city); d.h1 = es ? fill(A.es.h[0], V) : fill(A.h1, V); d.title = `${d.h1} | ${brand}`; d.meta = es ? fill(A.es.d[0], V) : fill(A.lp, V); break; }
      case 'guide': { const g = C.GUIDES.find(x => x.id === p.topic); const h = fill(g.h1, V); d.label = 'Guide · ' + h; d.slug = slug(h.replace(/['’]/g, '')); d.h1 = h; d.title = fill(g.title, V); d.meta = fill(g.meta, V); break; }
    }
    d.h1 = houseClean(d.h1); d.meta = fitMeta(d.meta); d.title = fitTitle(d.title, brand); d.label = houseClean(d.label);
    return d;
  }

  /* ---------- live URLs (the only internal link targets) ---------- */
  function anchorFrom(path) {
    if (path === '/') return 'Home';
    const seg = path.replace(/\/+$/, '').split('/').pop() || '';
    const t = decodeURIComponent(seg).replace(/\.[a-z]{2,4}$/i, '').replace(/[-_]+/g, ' ').trim();
    const w = t.split(/\s+/).map(x => ({ ca: 'CA', faq: 'FAQ', hoa: 'HOA', tpo: 'TPO', pvc: 'PVC', epdm: 'EPDM', cslb: 'CSLB', fema: 'FEMA', adu: 'ADU' }[x.toLowerCase()] || x.toLowerCase()));
    const s = w.join(' '); return houseClean(s.charAt(0).toUpperCase() + s.slice(1));
  }
  function parseLive(text, siteUrl) {
    const out = [], notes = []; if (!text || !text.trim()) return { items: out, notes, index: false };
    const host = hostOf(siteUrl); const locs = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => ({ url: m[1] }));
    const raw = locs.length ? locs : text.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.split('|').map(s => s.trim()); return m.length > 1 ? { anchor: m[0], url: m[1] } : { url: m[0] }; });
    let other = 0, xml = 0; const seen = new Set();
    raw.forEach(it => { let U; try { U = new URL(it.url.replace(/&amp;/g, '&'), siteUrl || 'https://example.com'); } catch (e) { return; }
      if (host && U.hostname.replace(/^www\./, '') !== host) { other++; return; }
      let path = U.pathname || '/'; if (/\.xml$/i.test(path)) { xml++; return; } if (/\.(jpe?g|png|gif|webp|svg|pdf|mp4|webm|css|js)$/i.test(path)) return;
      if (!/\.[a-z0-9]{2,5}$/i.test(path) && !path.endsWith('/')) path += '/'; if (seen.has(path)) return; seen.add(path);
      out.push({ path, url: path, anchor: it.anchor ? houseClean(it.anchor) : anchorFrom(path) }); });
    if (other) notes.push(`${other} URLs on another host ignored`); if (xml) notes.push(`${xml} child sitemaps listed: paste the page and post sitemaps they point to`);
    return { items: out, notes, index: xml > 0 && !out.length };
  }
  function liveHas(live, path) { return live.items.some(l => l.path === path); }
  const TOK = { replace: ['roof-replacement', 'new-roof', 'reroof', 're-roof', 'replacement', 'shingle', 'shingles', 'residential-roofing'], repair: ['roof-repair', 'repair', 'repairs', 'leak', 'leaks', 'roof-leak'],
    storm: ['storm', 'storm-damage', 'wind', 'wind-damage', 'rain', 'tarp', 'tarping', 'emergency'], fire: ['wildfire', 'fire-damage', 'rebuild', 'fire-rebuild', 'smoke'], harden: ['fire-hardened', 'hardening', 'class-a', 'ember', 'vents', 'wildfire-prepared', 'fire-resistant'],
    tile: ['tile', 'tile-roof', 'underlayment', 'lift-and-relay', 'relay', 'clay', 'concrete-tile'], solar: ['solar', 'detach', 'detach-and-reset', 'remove-and-reinstall', 'panels'],
    metal: ['metal', 'metal-roof', 'metal-roofing', 'standing-seam'], mh: ['mobile-home', 'manufactured', 'manufactured-home', 'mobile', 'roof-over'], mf: ['multifamily', 'apartment', 'apartments', 'condo', 'hoa'],
    comm: ['commercial', 'commercial-roofing', 'flat-roof', 'tpo', 'pvc', 'low-slope', 'cool-roof', 'title-24'], coat: ['coating', 'coatings', 'restoration', 'silicone', 'maintenance'], newc: ['new-construction', 'builder', 'builders'],
    contact: ['contact', 'estimate', 'inspection', 'schedule'], about: ['about', 'team', 'company'] };
  function tokScore(path, toks) { const pt = path.toLowerCase(); const parts = pt.split(/[\/_.-]+/).filter(Boolean); let s = 0; (toks || []).forEach(t => { if (t.includes('-') ? pt.includes(t) : parts.includes(t)) s += 2; }); return s; }
  function bestFor(live, key, cityTok, exclude) { let best = null, bs = 0; live.items.forEach(l => { if (exclude && exclude.has(l.path)) return; if (l.path === '/') return; const s = tokScore(l.path, TOK[key]) + (cityTok && l.path.toLowerCase().includes(cityTok) ? 1 : 0); if (s > bs) { bs = s; best = l; } }); return bs >= 2 ? best : null; }
  function linksFor(p, live, self, cfg, ms) {
    if (!live.items.length) return [];
    const out = []; const used = new Set([self]); const push = l => { if (l && !used.has(l.path) && out.length < 6) { used.add(l.path); out.push({ anchor: l.anchor, url: l.path }); } };
    const cityTok = p.city ? slug(p.city) : null;
    if (p.kind !== 'home' && p.kind !== 'landing') push(live.items.find(l => l.path === '/'));
    if (p.kind === 'landing') return out;
    const built = (cfg.build.lines || LINES).filter(k => C.AC[k]);
    const g = p.kind === 'guide' ? C.GUIDES.find(x => x.id === p.topic) : null; const ev = p.kind === 'event' ? HZ.EVENT_BY_ID[p.event] : null;
    const keys = p.kind === 'practice' ? (C.AC[p.line].related || []).concat(['contact'])
      : ev ? (ev.kind === 'fire' ? ['fire', 'harden', 'replace', 'repair'] : ['storm', 'repair', 'replace', 'tile'])
      : g ? (g.line ? [g.line].concat((C.AC[g.line] || {}).related || []) : ['replace', 'storm', 'repair'])
      : p.kind === 'about' ? ['contact'].concat(built.slice(0, 3)) : built.slice(0, 4);
    if (cityTok) live.items.filter(l => l.path.toLowerCase().includes(cityTok)).slice(0, 2).forEach(push);
    if (ev) eventCityRows(ev.id, ms).slice(0, 3).forEach(x => { const t = slug(x.c.name); push(live.items.find(l => l.path.toLowerCase().includes(t) && !used.has(l.path))); });
    keys.forEach(k => push(bestFor(live, k, cityTok, used)));
    return out;
  }

  /* ---------- blueprint ---------- */
  const areaCity = n => ({ '@type': 'City', name: n + ', ' + ST2 });
  const areaState = () => ({ '@type': 'State', name: STATE });
  function entity(cfg, ms) {
    const S = cfg.site; const e = { '@type': S.entity || 'RoofingContractor', name: S.brand || PH.brand };
    const d = String(S.phone || '').replace(/\D/g, ''); if (d.length === 10) e.telephone = '+1' + d; else if (d) e.telephone = S.phone;
    if (S.email) e.email = S.email;
    if (S.street || S.city) e.address = { '@type': 'PostalAddress', streetAddress: S.street || undefined, addressLocality: S.city || undefined, addressRegion: ST2, postalCode: S.zip || undefined, addressCountry: 'US' };
    const o = office(cfg); if (S.city && isN(o.lat)) e.geo = { '@type': 'GeoCoordinates', latitude: +(+o.lat).toFixed(5), longitude: +(+o.lon).toFixed(5) };
    if (S.hoursSchema) e.openingHours = S.hoursSchema;
    if (S.sameAs) e.sameAs = S.sameAs.split(/[\s,]+/).filter(Boolean);
    if (S.lic) e.identifier = { '@type': 'PropertyValue', propertyID: 'California Contractors State License Board license', value: S.lic };
    e.areaServed = ms && ms.length ? ms.map(c => areaCity(c.name)) : areaState();
    e.knowsAbout = (cfg.build.lines || LINES).filter(k => C.AC[k]).map(k => LAB(k));
    return e;
  }
  function testimonials(cfg) { const t = (cfg.site.testimonials || '').trim(); if (!t) return null; const items = []; t.split(/\n+/).forEach(line => { const m = line.split('|').map(x => x.trim()); if (m[0]) items.push({ quote: m[0], name: m[1] || '', role: m[2] || '' }); }); return items.length ? items : null; }
  function mediaSpec(p, cfg, V) {
    const S = cfg.site; const m = {}; const asg = cfg.media.assign || {}; const assets = cfg.media.assets || []; const pick = key => { const id = asg[key]; return id ? assets.find(x => x.id === id) : null; };
    const a = pick('page:' + p.id) || pick('city:' + (p.city || '')) || pick('county:' + (p.fips || '')) || pick('region:' + (p.reg || '')) || pick('kind:' + p.kind) || pick('default');
    const brand = V.brand;
    const alt = houseClean(p.kind === 'city' || p.kind === 'landing' ? `${brand} roofing crew at work in ${V.city}, ${STATE}` : p.kind === 'practice' ? `${LAB(p.line)}, ${brand}` : p.kind === 'county' ? `${brand}, roofing in ${V.county} County, ${STATE}` : p.kind === 'region' ? `${brand}, roofing in ${V.region}` : p.kind === 'event' ? `Roof work after the ${V.ev_name} in the ${V.ev_area}` : `${brand}, roofing contractor in ${V.officeCity}, ${STATE}`);
    const q = p.kind === 'city' || p.kind === 'landing' ? V.city + ' roof' : p.kind === 'practice' ? lc(LAB(p.line)) : p.kind === 'county' ? V.county + ' county' : p.kind === 'region' ? V.regionName : p.kind === 'event' ? 'roof repair' : 'roofing crew';
    if (p.kind !== 'guide') m.hero = { source: a ? 'assets/' + a.file : 'library:' + q, alt, kind: 'image', priority: true };
    const au = pick('author'); if (S.contact) m.author = { source: au ? 'assets/' + au.file : 'library:' + S.contact, alt: houseClean(`${S.contact}, ${brand}`), kind: 'image' };
    if (S.video_url && (p.kind === 'home' || p.kind === 'practice')) m.explainer = { source: S.video_url, alt: houseClean(`${brand}, how a roof inspection works`), kind: 'video' };
    return m;
  }
  function serviceItems(cfg, V, live, pages, only) {
    const ids = (only || cfg.build.lines || LINES).filter(k => C.AC[k]);
    return ids.slice(0, LINES.length || 13).map(k => { const pg = pages.find(q => q.kind === 'practice' && q.line === k); const own = pg && liveHas(live, '/' + pg.slug + '/') ? { path: '/' + pg.slug + '/' } : bestFor(live, k, null, null);
      return { title: LAB(k), text: fill(C.AC[k].card || firstSentence(C.AC[k].lede), V), url: own ? own.path : undefined, link: own ? 'Read more' : undefined }; });
  }
  function lawHTML(keys) {
    const e = FORGE_COMPILE.esc;
    return '<ul>' + keys.map(k => { const L = C.LAWPUB[k]; if (!L) return ''; const cite = L[3] ? `<a href="${e(L[3])}" rel="noopener">${e(L[2])}</a>` : e(L[2]); return `<li><strong>${e(L[0])}.</strong> ${e(L[1])} <small>(${cite})</small></li>`; }).join('') + '</ul>';
  }
  /* the Energy Code reroof table (roofing_law_evidence.md A9c; the 2022 and 2025 codes carry the same values) */
  const COOL_ROWS = [['Single family house', 'Steep', '4 and 8 to 15', '0.20', '0.75', '16'], ['Single family house', 'Low', '4 and 6 to 15', '0.63', '0.75', '75'], ['Multifamily', 'Steep', '4 and 8 to 15', '0.20', '0.75', '16'], ['Multifamily', 'Low', '2, 4 and 6 to 15', '0.63', '0.75', '75'],
    ['Nonresidential', 'Steep', '1 and 3', '0.20', '0.75', '16'], ['Nonresidential', 'Steep', '2 and 4 to 16', '0.25', '0.80', '23'], ['Nonresidential', 'Low', '1 to 16', '0.63', '0.75', '75'], ['Hotel and motel guest rooms', 'Steep', '2 to 15', '0.20', '0.75', '16'], ['Hotel and motel guest rooms', 'Low', '9, 10, 11, 13, 14 and 15', '0.55', '0.75', '64']];
  /* Spanish answer block by line; a line not listed reads the general answer */
  const ES_ANS = { replace: 'replace', metal: 'replace', newc: 'replace', storm: 'storm', repair: 'repair', mh: 'repair', fire: 'fire', harden: 'harden', tile: 'tile', solar: 'solar' };
  function blueprint(p, cfg, pages, live, ms) {
    const S = cfg.site; const missing = []; const V = varsFor(p, cfg, ms); const es = p.lang === 'es';
    const A = p.line ? C.AC[p.line] : null; const brand = V.brand; const esc = FORGE_COMPILE.esc;
    const F = t => fill(t, V, missing), FD = x => fillDeep(x, V, missing);
    const used = []; const facts = (keys, max) => keys.map(k => factItem(k, V)).filter(Boolean).slice(0, max || 4).map(f => { used.push(f); return { value: f.value, label: f.label, source: f.source }; });
    const media = mediaSpec(p, cfg, V); const tst = testimonials(cfg); const today = new Date().toISOString().slice(0, 10);
    const internal = linksFor(p, live, '/' + p.slug + '/', cfg, ms);
    const crumbs = liveHas(live, '/') && p.kind !== 'home' && p.kind !== 'landing' ? [{ name: es ? C.ES.breadcrumbs : 'Home', url: '/' }] : [];
    const trust = (es ? C.ES.trust : String(S.trust || '').split('|')).map(x => fill(x.trim(), V)).filter(Boolean).slice(0, 3);
    const CTA_L = S.cta_label || 'Book a roof inspection';
    const form = { provider: S.form_provider || 'html', button: es ? C.ES.form.button : CTA_L, consent: fill(es ? C.ES.form.consent : C.CONSENT, V), fields: es ? C.ES.form.fields : C.FIELDS, success: es ? C.ES.form.success : 'Thanks. We will call you shortly to schedule the inspection.' };
    if (S.form_shortcode) form.shortcode = S.form_shortcode; if (S.email) form.email_to = S.email;
    if (S.privacy_url) { form.privacy_url = S.privacy_url; form.privacy_label = es ? 'Aviso de privacidad' : 'Privacy notice'; }
    const cta = { primary: { label: es ? C.ES.cta.label : CTA_L, url: S.cta_url || '#contact' }, secondary: { label: es ? C.ES.cta.secondary : 'How it works', url: '#how-it-works' } };
    if (V.phone) { cta.primary.phone = V.phone; cta.primary.phone_label = es ? fill(C.ES.cta.phone_label, V) : 'Call ' + V.phone; }
    const page = { archetype: { home: 'home', about: 'about', practice: 'service', region: 'location', county: 'location', city: 'location', event: 'location', landing: 'landing', guide: 'article' }[p.kind], post_type: p.kind === 'guide' && S.guides_as_posts ? 'post' : 'page',
      slug: p.slug, title: p.title, h1: p.h1, meta_description: p.meta, language: es ? 'es-US' : 'en-US', template: p.kind === 'landing' ? (S.template === 'default' ? 'elementor_canvas' : S.template) : (S.template || 'default'),
      breadcrumbs: crumbs, summary: '', entity: entity(cfg, ms), dates: { published: today, modified: today }, cta, conversion: { sticky_mobile_bar: S.sticky !== false, trust, form }, internal_links: internal, schema_extra: [] };
    if (S.contact) page.author = { name: S.contact, credentials: `${S.contactRole || 'Qualifying individual'}, ${brand}`, bio: S.contactBio || '', media: media.author ? 'author' : undefined };
    if (p.kind === 'landing' && S.noindex_landing) page.noindex = true;
    const ev = p.event ? HZ.EVENT_BY_ID[p.event] : null;
    if (['practice', 'city', 'county', 'region', 'event'].includes(p.kind)) {
      page.service = { '@type': 'Service', serviceType: p.kind === 'practice' ? LAB(p.line) : 'Roofing',
        areaServed: p.kind === 'city' ? areaCity(V.city) : p.kind === 'county' ? { '@type': 'AdministrativeArea', name: V.county + ' County, ' + ST2 } : p.kind === 'region' ? { '@type': 'AdministrativeArea', name: V.regionName + ', ' + STATE } : ev ? eventCityRows(ev.id, ms).slice(0, 8).map(x => areaCity(x.c.name)) : areaState() };
      if (Array.isArray(page.service.areaServed) && !page.service.areaServed.length) page.service.areaServed = areaState();
    }
    const sec = [];
    const hero = o => sec.push(Object.assign({ type: 'hero', media: media.hero ? 'hero' : undefined, layout: media.hero ? 'split' : 'center', cta: ['primary'], trust: true }, o));
    const links = () => { if (internal.length) sec.push({ type: 'links', heading: es ? 'Más información' : 'Related', items: internal }); };
    const notice = () => { sec.push({ type: 'rich_text', id: 'notice', heading: '', html: `<p><small>${esc(F(es ? C.ES.notice : C.NOTICE))}</small></p>`, width: 'narrow' }); };
    const formSec = (h, t) => sec.push({ type: 'form', id: 'contact', heading: h, text: t });
    const testi = h => { if (tst && !es) { sec.push({ type: 'testimonials', heading: h || 'What customers say', items: tst.slice(0, 3) }); sec.push({ type: 'rich_text', id: 'results-note', heading: '', html: `<p><small>${esc(C.RESULTS_NOTE)}</small></p>`, width: 'narrow' }); } };
    const authors = () => { if (page.author && !es) sec.push({ type: 'authors', heading: 'Reviewed by' }); };
    const video = h => { if (media.explainer) sec.push({ type: 'video', media: 'explainer', heading: h || `How a roof inspection with ${brand} works`, description: page.meta_description }); };
    const band = (h, t) => sec.push({ type: 'cta_band', heading: h, text: t });
    const paras = a => a.map(t => F(t)).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');
    const FORM_H = 'Book a roof inspection', FORM_T = 'Tell us about the roof and how to reach you. We call back to schedule the inspection.';
    const BAND_T = 'We inspect the roof, photograph what we find and give you an itemized written estimate.';
    const RULES = 'Any roofing job of $1,000 or more needs a licensed contractor and a written contract, the down payment may not exceed $1,000 or 10 percent of the price, whichever is less, and whether a reroof needs a permit is set by the city or county.';
    const lines = (cfg.build.lines || LINES).filter(k => C.AC[k]);
    const licPara = () => `<p>${esc(brand)} holds California contractor license ${esc(V.lic)} from the Contractors State License Board${S.licClass ? `, classified ${esc(houseClean(S.licClass))}` : ''}. You can confirm the license, the bond and the workers compensation policy on the board's <a href="https://www.cslb.ca.gov/" rel="noopener">website</a> before you sign anything.</p>`;
    switch (p.kind) {
      case 'home': {
        page.summary = F('{brand}: roofing contractor with an office in {officeCity}, California, CSLB license {lic}.');
        hero({ eyebrow: F('Roofing contractor · {officeCity}, California'), lede: F('Licensed California roofing for {segText}, with an itemized written estimate and a contract that follows state law on every job.') });
        sec.push({ type: 'answer', heading: F('Who {brand} is'), body: S.about ? F(S.about) : F('{brand} is a roofing contractor with an office in {officeCity}, California, licensed by the Contractors State License Board under license {lic}. Our work covers {lineList}. Every job gets an itemized written estimate, a written contract with a down payment inside the legal limit, and the permit wherever the city or county requires one.') });
        sec.push({ type: 'key_facts', heading: 'California roofs by the numbers', items: facts(['s_ra20', 's_wave', 'tilestock_fact', 'lic_fact', 'down_fact']) });
        sec.push({ type: 'features', id: 'services', heading: 'Services', text: 'Each kind of roof work has its own page, its own rules and its own questions.', items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); video(); testi();
        sec.push({ type: 'faq', heading: 'Questions people ask before they call', items: FD(C.HOME_FAQ) });
        band(F('Book a roof inspection with {brand}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'about': {
        page.summary = F('About {brand}, a California roofing contractor.');
        hero({ eyebrow: brand, lede: F('A roofing contractor with an office in {officeCity}, California, licensed by the Contractors State License Board under license {lic}.') });
        sec.push({ type: 'answer', heading: F('Who is {brand}?'), body: S.about ? F(S.about) : F('{brand} is a roofing contractor with an office in {officeCity}, California. ' + (S.contact ? '{contact} is the ' + lc(S.contactRole || 'qualifying individual') + ' for the license. ' : '') + 'Our work covers {lineList}.') });
        sec.push({ type: 'key_facts', heading: 'At a glance', items: [{ value: V.lic, label: 'California contractor license, Contractors State License Board', source: brand }, { value: V.officeCity, label: 'office location', source: brand }].concat(S.contact ? [{ value: S.contact, label: lc(S.contactRole || 'qualifying individual'), source: brand }] : []).concat(V.hoursShort ? [{ value: V.hoursShort, label: V.hoursRest || 'hours', source: brand }] : []) });
        sec.push({ type: 'rich_text', heading: 'How we work', html: '<p>Every job starts with an inspection and an itemized written estimate that lists the materials, the labor, any permit and any decking or ventilation work, so prices can be compared line by line. The contract is in writing and signed before work starts, the down payment stays inside the legal limit of $1,000 or 10 percent, whichever is less, and later payments follow the work done. We pull the permit wherever the city or county requires one.</p>' + (S.warranty ? `<p>${esc(sent(F(S.warranty)))}</p>` : '') + (S.financing ? `<p>${esc(sent(F(S.financing)))}</p>` : '') });
        sec.push({ type: 'rich_text', heading: 'License, bond, insurance and certifications', html: licPara() + '<p>Every California licensee keeps a $25,000 contractor\'s bond on file with the board, and a C-39 roofing licensee must carry workers compensation insurance even with no employees. The license number must appear in a contractor\'s advertising and contracts.</p>' + (S.certs ? `<p>Manufacturer certifications: ${esc(houseClean(S.certs))}.</p>` : '') + (S.harden ? `<p>${esc(sent(S.harden))}</p>` : '') });
        sec.push({ type: 'faq', heading: 'Questions people ask', items: FD(C.HOME_FAQ).slice(0, 6) });
        band(F('Book a roof inspection with {brand}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'practice': {
        page.summary = F(`${LAB(p.line)} from {brand}: `) + firstSentence(strip(F(A.answer)));
        hero({ eyebrow: F(A.eyebrow), lede: F(A.lede) });
        sec.push({ type: 'answer', heading: A.aq, body: F(A.answer) });
        sec.push({ type: 'key_facts', heading: 'The numbers and the rules', items: facts(A.facts, 5) });
        sec.push({ type: 'rich_text', heading: 'What the work includes', html: F(A.what) });
        sec.push({ type: 'rich_text', heading: 'Before you hire a roofer', html: F(A.who) });
        sec.push({ type: 'rich_text', id: 'california-law', heading: 'The California rules that apply', html: lawHTML(A.law) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS[A.steps] || C.STEPS.replace) }); video(); testi();
        sec.push({ type: 'faq', heading: `Questions about ${lc(LAB(p.line))}`, items: FD(A.faq) }); authors();
        band(F(A.band + '.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'region': {
        const rg = HZ.REGION_BY_KEY[p.reg]; const idx = new Set(regionCounties(rg).map(c => c.i));
        page.summary = F('{brand} for {region}: about {rg_ra20} roofs there are 20 years or older by our estimate.');
        hero({ eyebrow: F('{brand} · {regionName}'), lede: F('Roofing for {segText} across {region}, from our office in {officeCity}.') });
        sec.push({ type: 'answer', heading: F('How old are the roofs in {region}, and what do they face?'), body: F('By our estimate from Census housing data, about {rg_ra20} one unit roofs in {region} are 20 years or older, out of about {rg_roofs}, and {rg_wave} more reach 20 within five years. {rg_hazSentence} {rg_windSentence}') });
        sec.push({ type: 'key_facts', heading: F('{regionName} by the numbers'), items: facts(['rg_roofs', 'rg_ra20', 'rg_fhsz', 'rg_fire', 'rg_fair', 'rg_fema']) });
        const cs = regionCounties(rg).slice().sort((a, b) => (b.roofs || 0) - (a.roofs || 0)).slice(0, 9);
        if (cs.length) sec.push({ type: 'table', heading: F('Roofs by county in {region}'), columns: ['County', 'One unit roofs', 'Roofs 20 years or older (estimate)', `Structures destroyed or damaged by wildfire, ${HZ.YRS.dins0} to ${HZ.YRS.dins1}`], rows: cs.map(pa => { const x = countyExtra(pa); return [pa.name, N(x.roofs), N(roundNice(x.ra20)), isN(x.fire_dest) ? N((x.fire_dest || 0) + (x.fire_dmg || 0)) : 'not in the data']; }) });
        sec.push({ type: 'rich_text', heading: 'What the numbers show', html: paras(['{rg_rainSentence}', RULES]) });
        sec.push({ type: 'features', id: 'services', heading: F('Roofing services in {region}'), items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); testi();
        sec.push({ type: 'faq', heading: F('Questions people in {region} ask'), items: FD(C.REGION_FAQ) });
        band(F('Book a roof inspection in {region}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'county': {
        const pa = CTYI[p.fips];
        page.summary = F('{brand} for {county} County: about {co_ra20} roofs there are 20 years or older by our estimate.');
        hero({ eyebrow: F('{brand} · {county} County'), lede: F('Roofing for {segText} across {county} County, from our office in {officeCity}.') });
        sec.push({ type: 'answer', heading: F('How old are the roofs in {county} County, and what do they face?'), body: F('By our estimate from Census housing data, about {co_ra20} one unit roofs in {county} County are 20 years or older, out of about {co_roofs}, and {co_wave} more reach 20 within five years. {co_hazSentence} {co_windSentence}') });
        sec.push({ type: 'key_facts', heading: F('{county} County by the numbers'), items: facts(['co_roofs', 'co_ra20', 'co_fhsz', 'co_fire', 'co_gust', 'co_fair', 'co_fema']) });
        const cs0 = ms.filter(c => c.pi === pa.i); const cs = cs0.concat(CITIES.filter(c => c.pi === pa.i && !cs0.includes(c)).sort((x, y) => y.pop - x.pop)).slice(0, 8);
        if (cs.length) sec.push({ type: 'table', heading: F('Roofs in {county} County communities'), columns: ['Community', 'One unit roofs', 'Roofs 20 years or older (estimate)', `Structures destroyed or damaged by wildfire, ${HZ.YRS.dins0} to ${HZ.YRS.dins1}`, 'FAIR Plan residential policies'], rows: cs.map(c => { const x = placeFx((c.zips || []).map(z => ZI[z]).filter(z => z && z.pi === pa.i)); const nd = v => isN(v) ? N(v) : 'not in the data'; return [c.name, N(x.roofs), N(roundNice(x.ra20)), isN(x.fire_dest) ? N((x.fire_dest || 0) + (x.fire_dmg || 0)) : 'not in the data', nd(x.fair_pif)]; }) });
        sec.push({ type: 'rich_text', heading: 'What the county numbers show', html: paras(['{co_rainSentence} {co_fairSentence}', '{co_femaSentence}', RULES]) });
        sec.push({ type: 'features', id: 'services', heading: F('Roofing services in {county} County'), items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); testi();
        sec.push({ type: 'faq', heading: F('Questions people in {county} County ask'), items: FD(C.COUNTY_FAQ) });
        band(F('Book a roof inspection in {county} County.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'city': {
        const c = CITY[p.city]; const here = S.city && S.city === c.name; const across = V.county ? ' and across {county} County' : '';
        page.summary = F('{brand} for {city}: roofing for {segText} in {city}' + (V.county ? ' and {county} County.' : '.'));
        hero({ eyebrow: F('{brand} · {city}'), lede: F('Roofing for {segText} in {city}' + across + ', ' + (here ? 'from our office here in {city}.' : 'from our office in {officeCity}.')) });
        sec.push({ type: 'answer', heading: F('How old are the roofs in {city}, and what do they face?'), body: F('{brand} works on roofs in {city}' + across + ', ' + (here ? 'from our office here.' : 'from our office in {officeCity}.') + ' By our estimate, about {c_ra20_sh} of the one unit roofs in the {city} ZIP codes are 20 years or older, and {c_wave} more reach 20 within five years. {c_hazSentence} {c_windSentence}') });
        sec.push({ type: 'key_facts', heading: F('{city} by the numbers'), items: facts(['c_roofs', 'c_ra20', 'c_fhsz', 'c_fire', 'c_gust', 'c_fair', 'c_fema', 'c_cz']) });
        sec.push({ type: 'rich_text', heading: F('Weather, fire and the codes in {city}'), html: paras(['{c_rainSentence} {c_fairSentence}', '{c_coolSentence} {c_femaSentence}', RULES]) });
        sec.push({ type: 'features', id: 'services', heading: F('Roofing services in {city}'), items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); testi(F('What {city} customers say'));
        sec.push({ type: 'faq', heading: F('Questions people in {city} ask'), items: FD(C.CITY_FAQ) });
        band(F('Book a roof inspection in {city}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'event': {
        const ang = angleOf(ev); const age = eventAge(ev); const fire = ev.kind === 'fire'; const rows = eventCityRows(ev.id, ms).slice(0, 8); const now = ang === 'fresh' || ang === 'recent';
        if (fire) {
          page.summary = F('The {ev_name}, {ev_when}: what it did in the {ev_area} and what roofs there need now.');
          hero({ eyebrow: F('{ev_name} · {ev_when}'), lede: F(ang === 'fresh' ? 'A roof that came through the {ev_name} can carry heat, ember and smoke damage that does not show from the street. Here is what the fire did in the {ev_area} and what to do now.'
            : ang === 'recent' ? 'Homes are still being repaired and rebuilt after the {ev_name}. Here is what the fire did in the {ev_area} and what a roof there has to meet.'
            : ang === 'wave' ? 'Homes rebuilt after the {ev_name} of {ev_year} were roofed within a few years of each other, and those roofs are now about {ev_age} years old.'
            : 'What the {ev_name} did in the {ev_area}, and what it means for roofs there now.') });
          sec.push({ type: 'answer', heading: F('What did the {ev_name} do in the {ev_area}?'), body: F('The {ev_name} began in {ev_when}' + (V.ev_acres ? ' and burned about {ev_acres} acres' : '') + '.' + (V.ev_dest ? ' CAL FIRE damage inspections recorded {ev_dest} structures destroyed' + (V.ev_dmg ? ' and {ev_dmg} damaged' : '') + '.' : ' It predates the digital damage inspection records that begin in 2013, so no structure count is given here.') + (V.ev_local ? (V.ev_localAll ? ' All of them were in the ZIP codes of the {ev_area}.' : ' Of those, {ev_local} were in the ZIP codes of the {ev_area}.') : '')) });
          sec.push({ type: 'key_facts', heading: F('The {ev_name} by the numbers'), items: facts(['ev_dest', 'ev_dmg', 'ev_local', 'ev_acres', ang === 'fresh' ? 'rcv_fact' : ang === 'recent' ? 'classA_fact' : 'tile_fact', 'gouge_fact']) });
          if (rows.length && rows.some(x => x.est > 0)) sec.push({ type: 'table', heading: F('Where the {ev_name} did the most damage in the area'), columns: ['Community', 'Structures destroyed', 'Structures damaged', 'One unit roofs in its ZIP codes'], rows: rows.filter(x => x.est > 0).map(x => [x.c.name, N(x.dest), N(x.dmg), N(sum((x.c.zips || []).map(z => (ZI[z] || {}).roofs)))]) });
          sec.push({ type: 'rich_text', heading: now ? 'What a roof needs after the fire' : ang === 'wave' ? F('The roofs put on after the {ev_name}') : 'What it means now',
            html: now ? paras(['Heat blisters and cracks roofing, embers lodge in valleys, gutters and vents, and smoke and ash enter the attic. A roof that stood through the {ev_name} is worth an inspection with photos, and the Department of Insurance advises owners to speak to their insurer before signing a repair contract.', 'A rebuilt or reroofed home in a fire zone needs a Class A roof assembly, ember resistant vents, protected eaves and noncombustible gutters. For repairs after a declared emergency you have seven business days to cancel a contract, the down payment is capped at $1,000 or 10 percent, whichever is less, and repair prices may not rise more than 10 percent for 180 days apart from documented cost increases. A roofer does not negotiate a claim for you; your insurer decides coverage under your policy.'])
              : ang === 'wave' ? paras(['Homes rebuilt after the {ev_name} got their roofs within a few years of each other, so those roofs have aged together and are now about {ev_age} years old. A shingle roof is commonly figured at about twenty years, and the underlayment under tile at about 25.', 'In a fire zone, replacing 50 percent or more of a roof within 12 months requires a Class A assembly. ' + RULES])
              : paras(['Roofs that stood through the {ev_name} have had more summers and winters since. A shingle roof near twenty years old, or a tile roof 25 years old or more, is worth an inspection before the rainy season.', RULES]) });
          sec.push({ type: 'features', id: 'services', heading: 'Fire and replacement work we do', items: serviceItems(cfg, V, live, pages, ['fire', 'harden', 'replace', 'repair', 'tile'].filter(k => lines.includes(k) || k === 'fire' || k === 'harden')) });
          sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(now ? C.STEPS.fire : ang === 'wave' ? C.STEPS.replace : C.STEPS.harden) });
          sec.push({ type: 'faq', heading: now ? F('Questions after the {ev_name}') : 'Questions owners ask', items: now ? FD(C.FIRE_FAQ) : ang === 'wave' ? FD(C.FIRE_LATE_FAQ) : FD(C.AC.harden.faq).slice(0, 4) }); authors();
          band(now ? F('Get your roof inspected after the {ev_name}.') : 'Get an itemized roof estimate.', BAND_T);
        } else {
          const what = ev.kind === 'ar' ? 'reached the coast' + (V.ev_at ? ' near ' + V.ev_at : '') + ' in {ev_when}' + (V.ev_rank ? ' as an {ev_rank} on the five step atmospheric river scale' : '') : 'struck in {ev_when}' + (V.ev_gust ? ' with gusts reported up to {ev_gust} mph' : '');
          page.summary = F('The {ev_name}: what it did to roofs in the {ev_area} and what owners should check now.');
          hero({ eyebrow: F('{ev_kind} · {ev_when}'), lede: F(ang === 'fresh' ? 'Damage from the {ev_name} is not always visible from the ground. Here is what it brought to the {ev_area} and what to do now.'
            : ang === 'recent' ? 'Damage from the {ev_name} can still be on roofs that were never inspected closely. Here is what it brought to the {ev_area} and what to check before the next wet winter.'
            : 'What the {ev_name} brought to the {ev_area}, and what it means for roofs there now.') });
          sec.push({ type: 'answer', heading: F('What did the {ev_name} do to roofs in the {ev_area}?'), body: F('The {ev_name} ' + what + '.' + (V.ev_hu ? ' About {ev_hu} homes are in the ZIP codes of the {ev_area} it reached.' : '') + (ev.kind === 'ar' ? ' Long, wind driven rain finds worn underlayment, lifted shingles, slipped tile and blocked drains, and the leaks often show up days later.' : ' Strong gusts lift and crease shingles, slide and break tile and strip ridge caps without always leaving damage that shows from the street.')) });
          sec.push({ type: 'key_facts', heading: F('The {ev_name} by the numbers'), items: facts(['ev_rank', 'ev_gust', 'ev_hu', ang === 'fresh' ? 'clock_fact' : 'life_fact', ang === 'fresh' ? 'gouge_fact' : 'tile_fact']) });
          if (rows.length) sec.push({ type: 'table', heading: F('Communities in the area the {ev_name} reached'), columns: ['Community', 'Homes in its ZIP codes', 'One unit roofs', 'Roofs 20 years or older (estimate)'], rows: rows.map(x => [x.c.name, N(x.hu), N(x.roofs), N(roundNice(x.ra20))]) });
          sec.push({ type: 'rich_text', heading: now ? 'Damage that can still be there' : 'What it means now',
            html: ang === 'fresh' ? paras(['A roof that went through the {ev_name} without a close inspection is worth one now, slope by slope, with photos. If you reported damage, keep the claim number; your insurer decides coverage under your policy.', 'An insurer must acknowledge a claim within 15 calendar days, accept or deny it within 40 days of proof of claim and pay within 30 days of accepting it. A roofer does not negotiate a claim for you, and it is unlawful for a contractor to offer a price reduction meant to offset your deductible.'])
              : paras(['Wind and long rain loosen flashing, lift shingles and expose worn underlayment without tearing anything off, and that damage tends to show as a leak in the next wet winter. A roof that went through the {ev_name} without a close inspection is worth one now, with photos.', RULES]) });
          sec.push({ type: 'features', id: 'services', heading: 'Storm and repair work we do', items: serviceItems(cfg, V, live, pages, ['storm', 'repair', 'replace', 'tile', 'metal'].filter(k => lines.includes(k) || k === 'storm')) });
          sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(ang === 'fresh' ? C.STEPS.storm : C.STEPS.repair) });
          sec.push({ type: 'faq', heading: now ? F('Questions after the {ev_name}') : 'Questions owners ask', items: ang === 'fresh' ? FD(C.STORM_FAQ) : ang === 'recent' ? FD(C.STORM_LATE_FAQ) : FD(C.AC.repair.faq).slice(0, 4) }); authors();
          band(now ? 'Get your roof checked for storm damage.' : 'Get an itemized roof estimate.', BAND_T);
        }
        formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'landing': {
        page.breadcrumbs = []; page.summary = es ? F(`Página de campaña: {city}.`) : F(`Campaign landing page: ${LAB(p.line)}, {cityFull}.`);
        if (es) {
          const com = COM_LINES.includes(p.line);
          hero({ eyebrow: F(A.es.h[1] || A.es.h[0]), lede: F(A.es.d[0]), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: C.ES.aq, body: C.ES.answer[ES_ANS[p.line] || 'general'] });
          sec.push({ type: 'key_facts', heading: '', items: [{ value: C.ES.facts.ruleV, label: C.ES.facts.rule, source: C.ES.facts.ruleSrc }, { value: V.officeCity, label: C.ES.facts.office, source: brand }, { value: V.lic, label: C.ES.facts.lic, source: brand }] });
          sec.push({ type: 'features', heading: 'Por qué llamarnos', items: FD(C.ES.features) });
          sec.push({ type: 'faq', heading: 'Antes de llamar', items: FD(C.ES.faq.filter(f => !com || f.id === 'lic').map(f => ({ q: f.q, a: f.a }))) });
          formSec(C.ES.formHead, F(A.es.d[1] || A.es.d[0])); band(F(C.ES.band.heading), C.ES.band.text);
        } else {
          hero({ eyebrow: F(A.eyebrow), lede: F(A.lp), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: A.aq, body: F(A.answer) });
          sec.push({ type: 'key_facts', heading: '', items: facts(A.lfacts, 3) });
          sec.push({ type: 'features', heading: 'Before you call', items: [{ title: F('CSLB license {lic}'), text: 'Look it up on the Contractors State License Board website before you sign anything.' }, { title: F('Office in {officeCity}'), text: F('{officeLine}') }, { title: 'The rule that matters', text: A.dl }] });
          sec.push({ type: 'faq', heading: 'Questions people ask', items: FD(A.faq).slice(0, 3) });
          formSec(FORM_H, FORM_T); band(F(A.band + ' in {city}.'), BAND_T);
        }
        notice(); break; }
      case 'guide': {
        const g = C.GUIDES.find(x => x.id === p.topic);
        page.summary = firstSentence(strip(F(g.answer)));
        hero({ eyebrow: 'Guide · ' + (g.scope === 'city' ? V.city : STATE), lede: F(g.meta), layout: 'center', media: undefined, trust: false, cta: ['primary'] });
        sec.push({ type: 'answer', heading: 'The short answer', body: F(g.answer) });
        sec.push({ type: 'key_facts', heading: 'The facts behind it', items: facts(g.facts, 5) });
        if (g.table === 'coolzones') sec.push({ type: 'table', heading: 'Cool roof values for a reroof, by building, slope and climate zone', columns: ['Building', 'Slope', 'Climate zones', 'Least aged solar reflectance', 'Least thermal emittance', 'Or least solar reflectance index'], rows: COOL_ROWS });
        if (g.table === 'cityevents') { const c = CITY[p.city]; const evs = c ? cityExtra(c).events.slice(0, 8) : [];
          if (evs.length) sec.push({ type: 'table', heading: F('Fires, storms and wind events on record at the {city} ZIP codes'), columns: ['Event', 'Year', 'Kind', 'On record at these ZIP codes'], rows: evs.map(([e, s]) => [cap1(e.name), String(e.year), KINDL[e.kind] || 'Event', e.kind === 'fire' ? (s.est ? `${N(s.dest)} structures destroyed, ${N(s.dmg)} damaged` : 'perimeter reached these ZIP codes') : e.kind === 'ar' ? (e.rank ? 'AR' + e.rank + ' at landfall' : 'landfall at this latitude') : (s.gust ? `gusts to ${N(s.gust)} mph` : 'reached these ZIP codes')]) }); }
        g.body.forEach((b, i) => { const h = F(b); if (strip(h)) sec.push({ type: 'rich_text', heading: F(g.heads[i] || ''), html: h }); });
        sec.push({ type: 'faq', heading: 'Questions readers ask', items: FD(g.faq).filter(f => f.a) }); authors();
        band(F('Book a roof inspection with {brand}.'), BAND_T); notice(); links(); break; }
    }
    const bp = { forge: '1', site: { url: S.url || 'https://www.example.com', name: brand, cms: S.cms || undefined, brand: { name: brand, primary: S.primary, accent: S.accent, dark: S.dark, font_heading: S.font_heading || undefined, font_body: S.font_body || undefined, logo_url: S.logo_url || undefined, globals: S.globals !== false } }, page, media, sections: cleanDeep(sec) };
    bp.page.summary = houseClean(bp.page.summary); bp.page.conversion.trust = trust.map(houseClean);
    bp.page.internal_links = internal.map(l => ({ anchor: houseClean(l.anchor), url: l.url }));
    if (!media.author && bp.page.author) delete bp.page.author.media;
    bp._facts = used; bp._missing = missing.filter((x, i, arr) => arr.indexOf(x) === i);
    return bp;
  }

  /* ---------- checks ---------- */
  function pageText(bp) {
    const out = []; const pg = bp.page;
    out.push(['seo.title', pg.title || ''], ['seo.h1', pg.h1 || ''], ['seo.meta', pg.meta_description || '']);
    (pg.conversion.trust || []).forEach((t, i) => out.push(['hero.trust' + i, t]));
    if (pg.conversion.form && pg.conversion.form.consent) out.push(['form.consent', pg.conversion.form.consent]);
    for (const s of bp.sections) { const tag = s.id === 'notice' ? 'notice' : s.id === 'results-note' ? 'results' : s.type;
      ['eyebrow', 'lede', 'body', 'text', 'html', 'heading', 'caption'].forEach(k => { if (s[k]) out.push([tag + '.' + k, strip(s[k])]); });
      (s.items || []).forEach((it, i) => { ['q', 'a', 'text', 'label', 'title', 'value', 'quote', 'anchor'].forEach(k => { if (it[k]) out.push([tag + '.' + k + i, String(it[k])]); }); });
      (s.steps || []).forEach((st, i) => { out.push([tag + '.s' + i, st.title + '. ' + st.text]); });
      (s.rows || []).forEach((r, i) => out.push([tag + '.r' + i, r.join(' ')])); }
    return out;
  }
  const ctxOf = cfg => ({ lic: cfg.site.lic || '', offices: officeList(cfg.site), certs: cfg.site.certs || '', fire: cfg.site.harden || '', harden: cfg.site.harden || '', juris: STATE });
  const SOLAR_LIC = /\bC[\s-]?10\b|\bC[\s-]?46\b|\bA\b|\bB\b|general (engineering|building)|electrical|solar/i;
  function checks(bp, r, cfg, p) {
    const I = []; const add = (id, sev, where, ev, msg, cite, fix) => { if (!I.some(x => x.id === id && x.where === where)) I.push({ id, sev, where, ev, msg, cite, fix }); };
    const txt = pageText(bp); const ctx = ctxOf(cfg);
    const PHR = /your company|\[license number\]|CSLB license number|your city/i; let ph = 0;
    txt.forEach(([where, t]) => satchelLint(t, Object.assign({ web: true }, ctx)).forEach(l => { const id = l.rule.id;
      if (id === 'HOUSE2' && PHR.test(l.ev)) { ph++; return; }
      add(id, l.rule.sev, where, l.ev, l.rule.name, l.rule.cite, l.rule.fix); }));
    if (ph) { const miss = [!cfg.site.brand && 'company name', !cfg.site.lic && 'CSLB license number', !cfg.site.city && 'office city'].filter(Boolean); add('COMPANY', 'block', 'page', `${ph} placeholder${ph === 1 ? '' : 's'}`, `Company details missing${miss.length ? ': ' + miss.join(', ') : ''}; the page prints a placeholder`, 'Bus. & Prof. Code 7030.5; house style', 'Fill step 1 or the Company panel (top right).'); }
    const lines = (cfg.build.lines || LINES); const res = p && p.line ? RES_LINES.includes(p.line) : lines.some(k => RES_LINES.includes(k));
    const all = txt.map(x => x[1]).join('\n');
    satchelLint(all, Object.assign({ asset: true, page: true, res }, ctx)).filter(l => l.rule.id === 'LIC1' || l.rule.id === 'LIC2').forEach(l => add(l.rule.id, l.rule.sev, 'page', l.ev, l.rule.name, l.rule.cite, l.rule.fix));
    const src = r.html + '\n' + JSON.stringify(r.schema);
    ((typeof SAT !== 'undefined' && SAT.web) || []).forEach(w => { let ev = null; try { ev = w.test(src, ctx); } catch (e) { } if (ev) add(w.id, w.sev, 'page source', ev, w.name, w.cite, w.fix); });
    if (p && p.line === 'harden' && !cfg.site.harden) add('HARD0', 'note', 'page', 'no hardening credentials set', 'Fire hardening page: the copy makes no credential claim; add one in step 1 only if the company holds it by that exact name', 'Cal. Code Regs. tit. 10, 2644.9 (no discount percentage is set); house style', 'Optional: enter the wildfire hardening credentials in step 1.');
    if (p && p.line === 'solar' && !SOLAR_LIC.test(cfg.site.licClass || '')) add('LIC5', 'note', 'page', cfg.site.licClass ? 'classifications: ' + cfg.site.licClass : 'no classifications set', 'Solar detach and reset page: the panels are removed and reinstalled by a C-10 or C-46 contractor or an A or B licensee; confirm who holds that license', 'Los Angeles County Building Code Manual 1512 Article 1', 'Enter the license classifications in step 1, or name the licensed solar or electrical subcontractor in the contract.');
    (r.lint || []).forEach((s, li) => { const block = /^BLOCK/.test(s); const media = /^MEDIA/.test(s); const lk = /no internal links/.test(s);
      add('FORGE', block ? 'block' : (media || lk) ? 'note' : 'warn', 'compiler ' + (li + 1), '', lk ? 'No internal links yet: paste the live sitemap in step 4 and links are drawn from it' : media ? s.replace(/\s*;\s*resolved at deploy.*$/, '').replace(/ — .*$/, '').replace(/^MEDIA: /, 'Media ') + ', resolved at deploy' : s, '', ''); });
    if ((bp.page.h1 || '').length > 70) add('LEN', 'warn', 'seo.h1', bp.page.h1.length + ' chars', 'H1 over 70 characters', '', 'Shorten in the studio.');
    if ((bp.page.title || '').length > 60) add('LEN', 'warn', 'seo.title', bp.page.title.length + ' chars', 'Title over 60 characters', '', 'Shorten in the studio.');
    if (bp._missing.length) add('VARS', 'warn', 'template', bp._missing.join(', '), 'Template values without data on this page were dropped; read the page for gaps', '', 'Fill the field in step 1 or pick a place with the data.');
    const n = s => I.filter(x => x.sev === s).length;
    return { issues: I.sort((x, y) => ['block', 'warn', 'note'].indexOf(x.sev) - ['block', 'warn', 'note'].indexOf(y.sev)), block: n('block'), warn: n('warn'), note: n('note') };
  }
  const wordCount = bp => pageText(bp).filter(([w]) => !w.startsWith('seo.') && !w.startsWith('form.')).reduce((t, [, s]) => t + words(s), 0);
  return { KL, CITY, LINES, PH, METRICS, ST, HZ, FACT_KEYS, defaultCfg, syncBrand, markets, eventOptions, eventLocal, chosenEvents, stormOptions: eventOptions, stormLocal: eventLocal, chosenStorms: chosenEvents, angleOf, plan, blueprint, checks, pageText, wordCount, parseLive,
    cityExtra, countyExtra, regionExtra, distMi, office, factItem, baseVars, varsFor, fill, anchorFrom, officeList };
})();

registerModule({
  key: 'forge', num: '09', title: 'Site Forge', desc: 'Service, city, county, region, event and guide pages written from the atlas, linted by the Compliance Satchel and compiled for WordPress',
  mount(root) {
    const E = FORGE, FC = FORGE_COMPILE;
    const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; };
    const saved = store.get('cg.forge.v1', null);
    let CFG = merge(E.defaultCfg(), saved || {});
    if (CFG.site.followBrand !== false) E.syncBrand(CFG, false);
    let LIVE = E.parseLive(CFG.site.live, CFG.site.url);
    let PLAN = { pages: [], removed: [], markets: [], events: [], storms: [] }, BUILT = new Map(), SEL = null, ASSETS = [], DEPLOYED = new Map(), WPSTAT = null, TAB = 'preview', PUBLISH_OK = false;
    const save = debounce(() => { CFG.media.assets = ASSETS.map(a => ({ id: a.id, file: a.file, kind: a.kind, w: a.w, h: a.h })); store.set('cg.forge.v1', CFG); }, 400);
    const SITE_F = [
      ['brand', 'Company name', 'text', 'The business name on the CSLB license. Empty, pages read "Your company" and every page blocks.'], ['url', 'Public site URL', 'url', 'Canonicals, schema and the live sitemap host use this.'], ['cms', 'WordPress URL, if different (headless)', 'url'],
      ['phone', 'Phone', 'tel', 'A local number that rings the office; a call tracking number should forward to it.'], ['email', 'Lead email (form notifications)', 'email'],
      ['lic', 'CSLB license number', 'text', 'Printed in the trust strip, the notice and the schema of every page. A licensed contractor must put the license number in all advertising and contracts (Bus. & Prof. Code 7030.5), and any job of $1,000 or more needs a license (7048). Empty, every page blocks.'],
      ['licClass', 'License classifications', 'text', 'For example: C-39 Roofing; C-46 Solar; B General Building. The solar detach and reset page asks who holds the C-10 or C-46 (or A or B) license for the panel work.'],
      ['contact', 'Qualifying individual or owner (optional)', 'text', 'Named on the About page and as the reviewer of the service pages and guides.'], ['contactRole', 'Their role, as printed', 'text'], ['contactBio', 'Two sentences about them (optional)', 'text'],
      ['street', 'Office street', 'text', 'Written without hyphens or dashes; it prints in every page footer.'], ['city', 'Office city', 'text', 'A real office customers can reach; Google, Local Services Ads and customers check it.'], ['zip', 'ZIP', 'text'], ['offices', 'Other office cities, comma separated', 'text'],
      ['hours', 'Hours, as customers read them', 'text', 'Only if actually staffed.'], ['hoursEs', 'Hours in Spanish', 'text'], ['hoursSchema', 'Hours for schema (openingHours)', 'text'],
      ['warranty', 'Workmanship warranty statement (optional)', 'text', 'Exact terms only; prints on the About page. "Lifetime" claims are flagged.'], ['financing', 'Financing statement (optional)', 'text', 'A payment, a number of payments, a down payment or a rate needs the full Regulation Z terms beside it, or the page blocks.'],
      ['certs', 'Manufacturer certifications (exact program names)', 'text', 'Only programs currently held; the Satchel blocks certification claims not listed here.'], ['harden', 'Wildfire hardening credentials (optional)', 'text', 'A training or designation the company holds, by its exact name. Prints on the About page. Leave blank if none; no page promises an insurance result.'], ['privacy_url', 'Privacy notice URL (optional)', 'url', 'Linked beside the consent line of every form when set.'],
      ['sameAs', 'Profiles for sameAs (Google, Facebook, Nextdoor), comma separated', 'text'], ['logo_url', 'Logo URL', 'url'], ['font_heading', 'Heading font', 'text'], ['font_body', 'Body font', 'text'],
      ['cta_label', 'Primary button label', 'text'], ['cta_url', 'Primary button URL', 'text'], ['form_shortcode', 'Form shortcode (plugin forms)', 'text'], ['video_url', 'Explainer video URL (YouTube or Vimeo)', 'url'], ['span', 'Spanish landing pages where Spanish at home is at least (%)', 'number'],
    ];
    const PLACE = { brand: 'Your company', lic: 'License number', city: 'Your city', street: '100 Main Street, Suite 200', cta_label: 'Book a roof inspection', contactRole: 'Qualifying individual' };
    const kindOpts = Object.entries(E.KL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const ctyOpts = E.HZ.COUNTIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('');
    const regOpts = E.HZ.REGIONS.map(r => `<option value="${r.key}">${esc(r.name)}</option>`).join('');
    root.innerHTML = mastHTML({ eyebrow: 'Module 09 · Site Forge', title: 'Site Forge', dek: 'The atlas turned into the website its campaigns land on: a service page for each of the thirteen roofing lines, a page for each market city, optional county and region hubs, event pages for the wildfires, atmospheric rivers and wind events on record at the market\'s ZIP codes, campaign landing pages in English and Spanish, and data and rules guides written from the roof stock, the fire and weather record and the California law evidence. Every page prints the company name, the CSLB license number and a real office, is linted by the Compliance Satchel, carries no dashes and no hyphens but the ones in license classifications such as C-39, compiles in the browser to Elementor, semantic HTML and JSON-LD, and deploys to WordPress as drafts through the FORGE bridge.',
      meta: [`<b>${N(CITIES.length)}</b> cities with roof, fire and weather facts`, `<b>${N(E.HZ.COUNTIES.length)}</b> counties · <b>${E.HZ.REGIONS.length}</b> regions · <b>${N(E.HZ.EVENTS.length)}</b> events on the ledger`, `<b>${FCOPY.GUIDES.length}</b> guide topics · <b>${PL.length}</b> service lines`, '<b>Internal links</b> only to live URLs'],
      bar: 'Site Forge', barsub: 'Plan, build, deploy', actions: [['f9Pack', '↓ Pack'], ['f9ElZ', '↓ Elementor'], ['f9BpZ', '↓ Blueprints'], ['f9Bridge', '↓ Bridge plugin'], ['f9LedX', '↓ Ledger'], ['f9Save', '⤓ Save'], ['f9Load', '⤒ Load']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the forge does and does not do', `Modules one to eight say where the old roofs, the fire zones and the storm damage are, which ZIPs pay back, what the license, contract and claims rules are and what the ads say. This module writes the pages those ads land on. Describe the company once, choose the markets, tick the page types, and the forge plans the set, writes each page from the atlas's own numbers with a public source beside every figure, and checks it. It never publishes on its own, never writes a review, a rating or a job result, never says what insurance covers, never promises an insurance discount, renewal or price, never offers to negotiate a claim or anything toward a deductible, never links to a page that is not live on the site's sitemap, and never uses Ahrefs. Deploying from the hosted atlas is blocked by the viewer's network rules, so deploy from the downloaded standalone file or hand the pack to the FORGE skill.`)}
      <div id="f9FirmWarn"></div>
      <input type="file" id="f9LoadF" accept=".json,application/json" hidden>
      <div class="card mt"><div class="card-h"><h3>1 · The company</h3><p>Everything here flows into every page: schema, calls to action, the form, the trust strip and the notice. The fields follow the Company panel (top right) while "Follow the Company panel" is ticked; saved in this browser as you type.</p></div><div class="card-b">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center"><button class="btn sec sm" id="f9Brand">⇠ Use the Company panel</button><button class="btn sec sm" id="f9Desk">⇠ Import markets from the Campaign Desk</button><label class="chk"><input type="checkbox" id="f9s_followBrand" data-k="followBrand"> Follow the Company panel</label></div>
        <div class="plan">${SITE_F.map(([k, l, t, h]) => `<div class="f"><label class="fl" for="f9s_${k}">${l}</label><input type="${t}" id="f9s_${k}" data-k="${k}"${PLACE[k] ? ` placeholder="${esc(PLACE[k])}"` : ''}>${h ? `<span class="hint">${h}</span>` : ''}</div>`).join('')}
          <div class="f"><label class="fl" for="f9s_entity">Schema entity type</label><select id="f9s_entity" data-k="entity"><option value="RoofingContractor">RoofingContractor</option><option value="HomeAndConstructionBusiness">HomeAndConstructionBusiness</option><option value="LocalBusiness">LocalBusiness</option></select></div>
          <div class="f"><label class="fl" for="f9s_form_provider">Lead form</label><select id="f9s_form_provider" data-k="form_provider"><option value="html">HTML form posting to the bridge</option><option value="elementor_pro">Elementor Pro form</option><option value="shortcode">Plugin shortcode</option></select></div>
          <div class="f"><label class="fl" for="f9s_template">Page template</label><select id="f9s_template" data-k="template"><option value="default">Theme default</option><option value="elementor_header_footer">Elementor full width</option><option value="elementor_canvas">Elementor canvas</option></select><span class="hint">Landing pages use canvas when the theme default is chosen.</span></div>
          <div class="f"><label class="fl">Brand colors: primary · accent · dark</label><div style="display:flex;gap:6px"><input type="color" id="f9s_primary" data-k="primary"><input type="color" id="f9s_accent" data-k="accent"><input type="color" id="f9s_dark" data-k="dark"></div></div>
          <div class="f wide"><label class="fl" for="f9s_trust">Trust strip (three items separated by |)</label><input type="text" id="f9s_trust" data-k="trust"><span class="hint">{lic}, {officeCity} and {hours} fill from the fields above; an item without data is dropped.</span></div>
          <div class="f wide"><label class="fl" for="f9s_about">Who the company is, two or three sentences (optional)</label><textarea id="f9s_about" data-k="about" placeholder="Leave empty and the forge writes it from the office, the license and the service lines."></textarea></div>
          <div class="f wide"><label class="fl" for="f9s_testimonials">Customer statements with written permission on file (one per line: quote | name | context). Leave empty to omit</label><textarea id="f9s_testimonials" data-k="testimonials"></textarea><span class="hint">The forge never writes a review or a testimonial. Statements print with "Customer statements are shared with permission and describe one job. Every roof is different." An incentivized or employee statement must say so, and reviews may not be bought, faked or filtered (16 CFR Part 465).</span></div>
          <div class="f wide"><div class="chips"><label class="chk"><input type="checkbox" id="f9s_sticky" data-k="sticky"> Sticky mobile call bar</label><label class="chk"><input type="checkbox" id="f9s_noindex_landing" data-k="noindex_landing"> noindex campaign landing pages</label><label class="chk"><input type="checkbox" id="f9s_guides_as_posts" data-k="guides_as_posts"> Publish guides as posts</label><label class="chk"><input type="checkbox" id="f9s_globals" data-k="globals"> Use Elementor global colors and fonts</label></div></div>
        </div></div></div>

      <div class="card mt"><div class="card-h"><h3>2 · Where to focus</h3><p>Cities come from the atlas's ZIP model: roof age, the fire and weather record and the thirteen service line pools. Rank them by the work the company wants, and limit them to where its crews will drive.</p></div><div class="card-b">
        <div class="plan">
          <div class="f"><label class="fl" for="f9Scope">Scope</label><select id="f9Scope"><option value="radius">Within a drive of the office</option><option value="county">Selected counties</option><option value="region">Selected regions</option><option value="all">All of California</option><option value="pick">Hand picked cities</option></select></div>
          <div class="f"><label class="fl" for="f9Miles">Miles from the office</label><input type="number" id="f9Miles" min="5" max="250" step="5"></div>
          <div class="f"><label class="fl" for="f9Ctys">Counties (county scope)</label><select id="f9Ctys" multiple size="4">${ctyOpts}</select></div>
          <div class="f"><label class="fl" for="f9Regs">Regions (region scope)</label><select id="f9Regs" multiple size="4">${regOpts}</select></div>
          <div class="f"><label class="fl" for="f9Metric">Rank by</label><select id="f9Metric">${Object.entries(E.METRICS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
          <div class="f"><label class="fl" for="f9N">Cities · minimum residents</label><div style="display:flex;gap:6px"><input type="number" id="f9N" min="1" max="120" style="width:80px"><select id="f9Min"><option value="0">any</option><option value="5000">5,000+</option><option value="10000">10,000+</option><option value="25000">25,000+</option><option value="50000">50,000+</option></select></div></div>
          <div class="f wide"><label class="fl" for="f9Picks">Hand picked cities (comma separated; other modules send their ZIPs here as cities)</label><input type="text" id="f9Picks" placeholder="Sacramento, Roseville, Elk Grove"></div>
        </div>
        <div class="split"><div class="mapcard" style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><div id="f9Map"></div><div class="legend" id="f9Leg"></div></div><div><div class="tscroll short" id="f9Mk"></div><p class="mini" style="margin-top:8px">Click a city to drop it from the plan; click a ZIP on the map to add or drop its city. Fire damage inspections, FAIR Plan policies and FEMA registrations are observed records by ZIP (grade A); the fire zone share is a map overlay on ZIP land (grade B); roof ages and the job pools are the atlas's models (grades B to D). "Residents" and every count sum the city's ZIP codes, which reach past city limits.</p></div></div>
      </div></div>

      <div class="card mt"><div class="card-h"><h3>3 · What to build</h3><p>Tick the page types and the lines. Event pages default to at most two events from the ledger at the plan's ZIP codes: the recent wildfire with the most structures destroyed or damaged there, and the strongest recent atmospheric river or wind event; failing those, a wildfire of 13 to 24 years ago, whose rebuilt homes have roofs of one age. Pick others below.</p></div><div class="card-b">
        <div class="chips" id="f9Types">${[['home', 'Home page'], ['about', 'About and license page'], ['practice', 'Service page per line'], ['regions', 'Region hub per region in the plan'], ['counties', 'County hub per county in the plan'], ['cities', 'City page per market city'], ['eventPages', 'Event page per wildfire, atmospheric river or wind event'], ['landing', 'Campaign landing page per line and city'], ['es', 'Spanish landing variants (only if someone at the company speaks Spanish with customers)'], ['guides', 'Data and rules guides']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-b="${k}"> ${l}</label>`).join('')}</div>
        <div class="dsec" style="margin-top:14px">Service pages</div><div class="chips" id="f9Lines"></div>
        <div class="dsec" style="margin-top:14px">Landing page lines</div><div class="chips" id="f9Land"></div>
        <div class="dsec" style="margin-top:14px">Events <span class="mini" id="f9RtNote"></span></div><div class="chips" id="f9Routes"></div>
        <div class="dsec" style="margin-top:14px">Guide topics</div><div class="chips" id="f9Topics"></div>
        <div class="mt">${callout('judg', 'Doorway risk: fewer, better city pages', 'Templated city pages are the fastest route into a doorway or scaled content problem. Every city page here carries that city\'s own roof stock, fire zone share, fire record, wind and rain figures and FAIR Plan count, but a dozen pages from one template still read as a pattern. If the site already has a page per suburb, consolidate or rewrite those before adding new ones, and publish a city page only where its numbers say something the others do not. The defaults are deliberately conservative: eight cities plus the office city, county and region hubs off, landing pages noindexed, and the per city guide off.')}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px"><button class="btn" id="f9Build">⚒ Build all pages</button><span class="mini" id="f9BuildNote"></span></div>
      </div></div>
      <div class="kpis" id="f9Kpis"></div>

      <div class="card mt"><div class="card-h"><h3>4 · Live pages on the site</h3><p>The only pages the forge will ever link to. Paste the site's XML sitemap (the page and post sitemaps, not the index) or a list of live URLs, one per line, optionally as "anchor | URL". Pages in this plan become link targets once they are published and appear here.</p></div><div class="card-b">
        <textarea id="f9Live" class="code" style="min-height:120px" placeholder="&lt;urlset&gt;&lt;url&gt;&lt;loc&gt;https://www.example.com/roof-replacement/&lt;/loc&gt;&lt;/url&gt;...&lt;/urlset&gt;"></textarea>
        <div class="mini" id="f9LiveSum" style="margin-top:6px"></div></div></div>

      <div class="card mt"><div class="card-h"><h3>5 · The page ledger</h3><p>Every planned page with its slug, lengths, words and checks. Click a row to open it in the studio; remove what you do not want.</p></div><div class="card-b">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px"><div class="ctl"><label class="fl" for="f9LType">Type</label><select id="f9LType"><option value="">All types</option>${kindOpts}</select></div><div class="ctl"><label class="fl" for="f9LSearch">Search</label><input type="search" id="f9LSearch" placeholder="city, line, slug"></div><label class="chk"><input type="checkbox" id="f9LRem"> Show removed pages</label></div>
        <div class="tscroll" id="f9Ledger"></div></div></div>

      <div class="card mt" id="f9Studio"><div class="card-h"><h3>6 · Page studio</h3><p id="f9StHead">Select a page in the ledger.</p></div><div class="card-b">
        <div class="plan"><div class="f"><label class="fl" for="f9StTitle">Title <span class="mini" id="f9StTitleC"></span></label><input type="text" id="f9StTitle"></div><div class="f"><label class="fl" for="f9StH1">H1 <span class="mini" id="f9StH1C"></span></label><input type="text" id="f9StH1"></div><div class="f"><label class="fl" for="f9StSlug">Slug</label><input type="text" id="f9StSlug"></div><div class="f wide"><label class="fl" for="f9StMeta">Meta description <span class="mini" id="f9StMetaC"></span></label><input type="text" id="f9StMeta"></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px"><button class="btn sm" id="f9StApply">Apply and rebuild</button><button class="btn sec sm" id="f9StReset">Discard edits</button><button class="btn sec sm" id="f9StRemove">Remove from plan</button><span class="spacer" style="flex:1"></span><button class="btn ghost sm" id="f9StBp">↓ Blueprint</button><button class="btn ghost sm" id="f9StEl">↓ Elementor template</button><button class="btn ghost sm" id="f9StHtml">↓ Preview HTML</button><button class="btn ghost sm" id="f9StBundle">↓ Bridge bundle</button></div>
        <div class="split21"><div style="min-width:0"><div class="ptabs" id="f9StTabs"><button data-v="preview" aria-pressed="true">Preview</button><button data-v="mobile" aria-pressed="false">Mobile</button><button data-v="blueprint" aria-pressed="false">Blueprint</button><button data-v="elementor" aria-pressed="false">Elementor JSON</button><button data-v="schema" aria-pressed="false">Schema</button><button data-v="html" aria-pressed="false">HTML</button></div><div id="f9StPane"></div></div>
          <div class="stack" style="min-width:0"><div><div class="dsec">Checks</div><div id="f9Checks"><span class="mini">No page open.</span></div></div><div><div class="dsec">Facts on this page · value, source, grade</div><div id="f9Facts"></div></div><div><div class="dsec">Internal links · live URLs only</div><div id="f9Links"></div></div></div></div>
      </div></div>

      <div class="card mt"><div class="card-h"><h3>7 · Media</h3><p>Drop photos and video of the company's own crews, finished roofs, trucks and office. Images are resized to 1920 pixels and converted to WebP in the browser. Assign each to the pages it belongs to; a page asset beats a city asset, which beats a county asset, a region asset, a page type asset and the site default. Unassigned slots resolve from the site's media library at deploy, and a page never ships with a placeholder.</p></div><div class="card-b">
        <div class="drop" id="f9Drop" tabindex="0" role="button">Drop files here or click to choose: JPG, PNG, WebP, MP4, WebM</div><input type="file" id="f9File" multiple accept="image/*,video/mp4,video/webm" hidden>
        <div class="xscroll mt"><table id="f9MediaTbl"><thead><tr><th class="l">Preview</th><th class="l">File</th><th>Size</th><th class="l">Assign to</th><th class="l">Alt text</th><th></th></tr></thead><tbody></tbody></table></div></div></div>

      <div class="card mt"><div class="card-h"><h3>8 · Deploy to WordPress</h3><p>Application Password over REST through the FORGE bridge plugin (download it from the bar above, then Plugins, Add New, Upload, Activate). Everything lands as a draft unless you choose to publish, and a page with a blocking check is refused. Credentials stay in this tab. <b>Every other platform</b> (headless WordPress with the Next.js kit, Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla, Ghost) publishes from <a href="#publish" data-go="publish">module 16, Publish</a>, which reads the pages built here.</p></div><div class="card-b">
        <div class="plan"><div class="f"><label class="fl" for="f9dUrl">WordPress URL</label><input type="url" id="f9dUrl"></div><div class="f"><label class="fl" for="f9dUser">Username</label><input type="text" id="f9dUser" autocomplete="off"></div><div class="f"><label class="fl" for="f9dPass">Application password</label><input type="password" id="f9dPass" autocomplete="off"><span class="hint">Users, Profile, Application Passwords. An Administrator account is needed for Elementor data.</span></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px"><button class="btn sec sm" id="f9dTest">Test connection</button><span class="mini" id="f9dNote">Not connected.</span></div>
        <div id="f9dCors" hidden>${callout('judg', 'The browser could not reach the site', `Inside the hosted atlas the viewer blocks every outbound connection, so deploy from the downloaded standalone file (with this page's origin added to the bridge's allowed origins in its settings) or download the pack and let the FORGE skill deploy from the shell. Origin of this page: <code id="f9dOrigin"></code>.`)}</div>
        <div class="chips" style="margin-top:10px"><label class="chk"><input type="checkbox" id="f9dMedia" checked> Upload assets and reuse library matches</label><label class="chk"><input type="checkbox" id="f9dPublish"> Publish instead of draft</label><label class="chk"><input type="checkbox" id="f9dOnlyNew" checked> Skip pages already deployed this session</label></div>
        <div id="f9dConfirm" hidden class="msg err" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="f9dConfirmT"></span><button class="btn sm" id="f9dConfirmGo">Publish them</button><button class="btn sec sm" id="f9dConfirmNo">Keep as drafts</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="f9dGo" disabled>Deploy pages</button><button class="btn sec" id="f9dLive" disabled>Refresh live URLs from the site</button><button class="btn sec" id="f9dLinks" disabled>Verify links against live URLs</button><button class="btn sec" id="f9dIdx" disabled>IndexNow published pages</button></div>
        <div class="status mt" id="f9dStatus">Not connected.</div>
        <div class="xscroll mt"><table id="f9dRes"><thead><tr><th class="l">Page</th><th class="l">Status</th><th class="l">Link</th><th class="l">Edit</th><th>Media</th><th class="l">Note</th></tr></thead><tbody></tbody></table></div></div></div>

      <div class="card mt"><div class="card-h"><h3>9 · Method, sources, grades and the hand off</h3><p>How a page is written, where every number comes from, and what to check before anything goes live.</p></div><div class="card-b" id="f9Method"></div></div>
      <div class="foot">Site Forge writes pages; it does not publish them, and nothing here is legal or insurance advice. The FORGE bridge plugin is a generic WordPress REST bridge; review it before installing on a production site.</div>
      </div>`;

    /* ---------- the company ---------- */
    const S = () => CFG.site;
    function writeSite() { $$('input[data-k], select[data-k], textarea[data-k]', root).forEach(i => { const k = i.dataset.k; const v = S()[k]; if (i.type === 'checkbox') i.checked = (k === 'globals' || k === 'followBrand') ? v !== false : !!v; else i.value = v == null ? '' : v; }); firmWarn(); }
    function readSite() { $$('input[data-k], select[data-k], textarea[data-k]', root).forEach(i => { const k = i.dataset.k; S()[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? +i.value : i.value.trim(); });
      if (E.CITY[S().city]) { S().lat = E.CITY[S().city].lat; S().lon = E.CITY[S().city].lon; } }
    function firmWarn() { const s = S(); const miss = [!s.brand && 'company name', !s.lic && 'CSLB license number', !s.city && 'office city'].filter(Boolean);
      $('#f9FirmWarn', root).innerHTML = miss.length ? callout('', `Pages preview with ${miss.map(m => m === 'company name' ? '"Your company"' : m === 'CSLB license number' ? '"[license number]"' : '"Your city"').join(', ')} and every page blocks`, `Set the ${listAndUI(miss)} in step 1 or in the Company panel (top right). The forge does not invent a company, a license or an office: a licensed contractor must put the license number in all advertising (Bus. & Prof. Code 7030.5), any job of $1,000 or more needs a license (7048), and Google, Local Services Ads and customers check the office.`) : ''; }
    const listAndUI = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    $$('input[data-k], select[data-k], textarea[data-k]', root).forEach(i => i.addEventListener('change', () => { readSite(); firmWarn(); save(); replan(); }));
    $('#f9Brand', root).onclick = () => { E.syncBrand(CFG, true); writeSite(); save(); replan(); toast(brandSet() ? 'Company fields taken from the Company panel' : 'The Company panel is empty: fill it (top right) or type the company here'); };
    $('#f9Desk', root).onclick = () => { if (MODI.desk && !MODI.desk.mounted) { MODI.desk.mounted = true; try { MODI.desk.mount($('#mod-desk')); } catch (e) { console.error(e); } } const d = MODI.desk && MODI.desk.plan ? MODI.desk.plan() : store.get('cg.desk.v1', null); if (!d) { toast('Open the Campaign Desk once so its plan exists'); return; }
      if (isN(d.spanTh) && d.spanTh > 0) S().span = d.spanTh; if ([].concat(d.lang || []).some(x => /^(es|spanish)/i.test(String(x)))) CFG.build.es = true;
      if (d.scope === 'county' && Array.isArray(d.counties)) { const fs = d.counties.filter(f => E.HZ.COUNTY_BY_FIPS[f]); if (fs.length) { CFG.focus.scope = 'county'; CFG.focus.counties = fs; } }
      if (d.scope === 'region' && Array.isArray(d.regions)) { const rk = ((META.model || {}).REGK) || {}; const rs = d.regions.map(r => E.HZ.REGION_BY_KEY[r] ? r : rk[r]).filter(r => E.HZ.REGION_BY_KEY[r]); if (rs.length) { CFG.focus.scope = 'region'; CFG.focus.regions = rs; } }
      const zips = d.zips || (d.scope === 'picks' ? d.picks : null); if (zips && zips.length) { const names = citiesFromZips(zips).slice(0, 24); if (names.length) { CFG.focus.scope = 'pick'; CFG.focus.picks = names; } }
      const lines = d.line === 'blend' ? (d.lines || []) : [d.line]; const ok = lines.filter(k => FCOPY.AC[k]); if (ok.length) { CFG.build.landingLines = ok.slice(0, 3); ok.forEach(k => { if (!CFG.build.lines.includes(k)) CFG.build.lines.push(k); }); }
      const dev = d.event || d.storm; const devOK = dev && E.HZ.EVENT_BY_ID[dev]; if (devOK) { CFG.build.eventPages = true; CFG.build.eventsAuto = false; CFG.build.events = [...new Set([dev].concat(E.chosenEvents(CFG, PLAN.markets)))].slice(0, 6); }
      writeSite(); syncFocus(); syncBuild(); save(); replan(); $('#f9BuildNote', root).textContent = `Imported from the Campaign Desk: ${CFG.focus.scope === 'pick' ? CFG.focus.picks.length + ' cities' : 'scope kept'}, ${CFG.build.landingLines.length} landing line${CFG.build.landingLines.length === 1 ? '' : 's'}${devOK ? ', an event page for the ' + E.HZ.EVENT_BY_ID[dev].name : ''}.`; };
    function citiesFromZips(zips) { const out = []; zips.forEach(z => { const c = CITIES.find(c => (c.zips || []).includes(z)) || (ZI[z] && E.CITY[ZI[z].city]); if (c && !out.includes(c.name)) out.push(c.name); }); return out; }

    /* ---------- focus ---------- */
    const map = new ZipMap($('#f9Map', root), { segHit: 'none', roads: false, aria: 'Map of the cities in the Site Forge plan', onSelect: zip => { const nm = citiesFromZips([zip])[0]; if (!nm) return; const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.picks = PLAN.markets.map(c => c.name); } if (F0.picks.includes(nm)) F0.picks = F0.picks.filter(x => x !== nm); else F0.picks.push(nm); syncFocus(); save(); replan(); },
      onHover: (zip, e) => { const z = ZI[zip]; if (!z) return; const nm = citiesFromZips([zip])[0]; const c = nm ? E.CITY[nm] : null; if (!c) { showTip(`<div class="tt">${esc(zip)}${z.city ? ' · ' + esc(z.city) : ''}</div><div class="ts">Not a city in the model</div>`, e); return; } const x = E.cityExtra(c); showTip(`<div class="tt">${esc(zip)} · ${esc(c.name)}</div>${tipRow('Roofs 20 years or older, city ZIPs (model)', N(x.ra20))}${isN(x.fhsz) ? tipRow('Land in High or Very High fire zones, city ZIPs', P(x.fhsz, 0)) : ''}${isN(x.fire_dest) ? tipRow('Structures destroyed or damaged by wildfire, ' + E.HZ.YRS.dins0 + ' to ' + E.HZ.YRS.dins1, N((x.fire_dest || 0) + (x.fire_dmg || 0))) : ''}${isN(x.fair_pif) ? tipRow('FAIR Plan residential policies', N(x.fair_pif)) : ''}${tipRow('FEMA roof or property registrations', N(x.fema))}${tipRow('Gross profit pool a year (model)', MM(c.fees))}${tipRow('Miles from office', D(E.distMi(c, CFG), 0))}<div class="tf">Click to add or drop this city</div>`, e); } });
    function syncFocus() { const f = CFG.focus; $('#f9Scope', root).value = f.scope; $('#f9Miles', root).value = f.miles; $('#f9Metric', root).value = f.metric; $('#f9N', root).value = f.n; $('#f9Min', root).value = String(f.minPop); $('#f9Picks', root).value = f.picks.join(', '); $$('#f9Ctys option', root).forEach(o => o.selected = (f.counties || []).includes(o.value)); $$('#f9Regs option', root).forEach(o => o.selected = (f.regions || []).includes(o.value)); }
    function readFocus() { const f = CFG.focus; f.scope = $('#f9Scope', root).value; f.miles = +$('#f9Miles', root).value || 45; f.metric = $('#f9Metric', root).value; f.n = clamp(+$('#f9N', root).value || 8, 1, 120); f.minPop = +$('#f9Min', root).value; f.counties = $$('#f9Ctys option', root).filter(o => o.selected).map(o => o.value); f.regions = $$('#f9Regs option', root).filter(o => o.selected).map(o => o.value); f.picks = $('#f9Picks', root).value.split(',').map(s => s.trim()).filter(s => E.CITY[s]); }
    ['#f9Scope', '#f9Miles', '#f9Metric', '#f9N', '#f9Min', '#f9Ctys', '#f9Regs', '#f9Picks'].forEach(s => $(s, root).addEventListener('change', () => { readFocus(); if (CFG.focus.scope === 'pick' && !CFG.focus.picks.length) CFG.focus.picks = PLAN.markets.map(c => c.name); syncFocus(); save(); replan(); }));
    function renderFocus() {
      const ms = PLAN.markets; const mk = (E.METRICS[CFG.focus.metric] || E.METRICS.fees);
      const zset = new Set(); ms.forEach(c => (c.zips || []).forEach(z => zset.add(z)));
      const vals = ms.map(c => mk[1](c)); const q = qScale(vals, 'green', 1); const cityOf = {}; ms.forEach(c => (c.zips || []).forEach(z => { if (!cityOf[z]) cityOf[z] = c; }));
      map.fill(zip => cityOf[zip] ? q.f(mk[1](cityOf[zip])) : null); map.dim(zset.size ? zset : null);
      const o = E.office(CFG); map.pins(o.set ? [{ id: 'office', lat: o.lat, lon: o.lon, r: 9, fill: cssv('--bench'), shape: 'diamond', title: 'Office' }] : []);
      const fk = [CFG.focus.scope, CFG.focus.miles, (CFG.focus.counties || []).join(',') + '/' + (CFG.focus.regions || []).join(','), CFG.focus.n, CFG.focus.minPop, CFG.focus.metric, CFG.focus.scope === 'pick' ? '' : 'x'].join('|'); if (fk !== map._fk) { map._fk = fk; if (zset.size && CFG.focus.scope !== 'all') map.fitTo([...zset]); else map.reset(); }
      const fmtV = v => /pool a year/.test(mk[0]) ? MM(v) : !isN(v) ? '—' : v < 10 && Math.round(v) !== v ? D(v, 1) : N(v);
      $('#f9Leg', root).innerHTML = legendHTML({ title: mk[0] + ', cities in the plan', R: q.R, lo: isN(q.lo) ? fmtV(q.lo) : '', hi: isN(q.hi) ? fmtV(q.hi) : '', note: o.set ? '◆ office' : 'No office set: the plan is statewide' });
      const dh = $('#f9Mk', root); dh._st = dh._st || { k: 'v', dir: -1 };
      dataTable(dh, [{ k: 'name', h: 'City', l: 1 }, { k: 'cty', h: 'County', l: 1, v: c => E.HZ.COUNTIES[c.pi] ? E.HZ.COUNTIES[c.pi].name : '' }].concat(o.set ? [{ k: 'mi', h: 'Miles', v: c => E.distMi(c, CFG), f: v => D(v, 0) }] : []).concat([{ k: 'v', h: mk[0].replace(/ \(model\)$/, ''), v: c => mk[1](c), f: v => fmtV(v) }, { k: 'r20', h: 'Roofs 20+ (model)', v: c => E.cityExtra(c).ra20, f: v => N(v) }, { k: 'fz', h: 'Fire zone land', v: c => E.cityExtra(c).fhsz, f: v => isN(v) ? P(v, 0) : '—' }, { k: 'fd', h: 'Fire destroyed or damaged', v: c => { const x = E.cityExtra(c); return isN(x.fire_dest) ? (x.fire_dest || 0) + (x.fire_dmg || 0) : null; }, f: v => isN(v) ? N(v) : '—' }, { k: 'fair', h: 'FAIR Plan policies', v: c => E.cityExtra(c).fair_pif, f: v => isN(v) ? N(v) : '—' }, { k: 'fema', h: 'FEMA registrations', v: c => E.cityExtra(c).fema, f: v => N(v) }, { k: 'pop', h: 'Residents (ZIPs)', f: v => K(v) }, { k: 'span', h: 'Spanish at home', v: c => E.cityExtra(c).span_sh, f: v => P(v, 0) }]), ms,
        { id: c => c.name, onClick: nm => { const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.picks = ms.map(c => c.name); } F0.picks = F0.picks.filter(x => x !== nm); syncFocus(); save(); replan(); } });
      if (!ms.length) dh.innerHTML = '<p class="mini">No city passes these filters. Widen the drive, lower the population floor or switch scope.</p>';
    }

    /* ---------- build choices ---------- */
    function chipRow(host, ids, sel, label, onToggle) { host.innerHTML = ids.map(id => `<button type="button" class="chip" data-id="${esc(id)}" aria-pressed="${sel.includes(id)}">${esc(label(id))}</button>`).join(''); $$('button', host).forEach(b => b.onclick = () => { onToggle(b.dataset.id); }); }
    const tog = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : arr.concat([id]);
    function syncBuild() { const B = CFG.build; $$('#f9Types [data-b]', root).forEach(i => i.checked = !!B[i.dataset.b]);
      chipRow($('#f9Lines', root), E.LINES, B.lines, id => PLI[id].short, id => { B.lines = tog(B.lines, id); syncBuild(); save(); replan(); });
      chipRow($('#f9Land', root), E.LINES, B.landingLines, id => PLI[id].short, id => { B.landingLines = tog(B.landingLines, id); syncBuild(); save(); replan(); });
      const opts = E.eventOptions(PLAN.markets); const chosen = E.chosenEvents(CFG, PLAN.markets); const ids = [...new Set(opts.map(e => e.id).concat(chosen))];
      chipRow($('#f9Routes', root), ids, chosen, id => { const e = E.HZ.EVENT_BY_ID[id]; const s = E.eventLocal(id, PLAN.markets); return e.label + ' · ' + (e.kind === 'fire' ? K(s.est) + ' structures' : K(s.hu) + ' homes'); }, id => { B.events = tog(chosen, id); B.eventsAuto = false; syncBuild(); save(); replan(); });
      $('#f9RtNote', root).innerHTML = (!ids.length ? ' · no event on the ledger reaches these ZIP codes (or the event ledger is not in the data file yet)' : PLAN.markets.length ? ' · wildfires: structures destroyed or damaged in the plan\'s ZIP codes; storms: homes in the ZIP codes reached' : ' · statewide') + (B.eventsAuto ? '; automatic: the worst recent wildfire and the strongest recent storm' : '; <a href="#" id="f9RtAuto">back to automatic</a>');
      const ra = $('#f9RtAuto', root); if (ra) ra.onclick = e => { e.preventDefault(); B.eventsAuto = true; B.events = []; syncBuild(); save(); replan(); };
      chipRow($('#f9Topics', root), FCOPY.GUIDES.map(g => g.id), B.topics, id => { const g = FCOPY.GUIDES.find(x => x.id === id); return g.label + (g.scope === 'city' ? ' (per city)' : ''); }, id => { B.topics = tog(B.topics, id); syncBuild(); save(); replan(); }); }
    $$('#f9Types [data-b]', root).forEach(i => i.onchange = () => { CFG.build[i.dataset.b] = i.checked; save(); replan(); });

    /* ---------- live URLs ---------- */
    $('#f9Live', root).addEventListener('change', () => { S().live = $('#f9Live', root).value; LIVE = E.parseLive(S().live, S().url); save(); renderLive(); rebuildBuilt(); });
    const hostOfUrl = u => { try { return new URL(u).hostname; } catch (e) { return u; } };
    function renderLive() { const L = LIVE; const host = $('#f9LiveSum', root);
      if (!L.items.length) { host.innerHTML = L.index ? '<b>This is a sitemap index.</b> Paste the child page and post sitemaps it lists.' : `<b>No live URLs yet.</b> Pages build without internal links until the site's live URLs are here${S().url ? ' (host ' + esc(hostOfUrl(S().url)) + ')' : ''}.`; return; }
      host.innerHTML = `<b>${N(L.items.length)} live URLs</b> on ${esc(hostOfUrl(S().url))}${L.notes.length ? ' · ' + esc(L.notes.join('; ')) : ''}. Examples: ${L.items.slice(0, 5).map(l => `<code>${esc(l.path)}</code>`).join(' ')}`; }

    /* ---------- plan and build ---------- */
    function replan() { PLAN = E.plan(CFG); const ids = new Set(PLAN.pages.map(p => p.id)); for (const k of [...BUILT.keys()]) if (!ids.has(k)) BUILT.delete(k); BUILT.forEach((b, id) => { const p = PLAN.pages.find(x => x.id === id); if (p) buildPage(p); }); renderFocus(); syncBuild(); renderKpis(); renderLedger(); renderMethod(); if (SEL) { if (ids.has(SEL)) openPage(SEL, true); else closeStudio(); } }
    function previewMedia(bp) { const out = {}; for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || ''; if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (a) out[k] = { id: 0, url: a.url, alt: a.alt || spec.alt, kind: a.kind, width: a.w, height: a.h }; } else if (/^https?:/.test(src) && spec.kind === 'video') out[k] = { id: 0, url: src, alt: spec.alt, kind: 'video' }; } return out; }
    function buildPage(p) { const prev = BUILT.get(p.id); const bp = prev && prev.override ? prev.override : E.blueprint(p, CFG, PLAN.pages, LIVE, PLAN.markets); const r = FC.compile(bp, previewMedia(bp)); const ch = E.checks(bp, r, CFG, p); const b = { bp, r, ch, words: E.wordCount(bp), override: prev ? prev.override : null }; BUILT.set(p.id, b); return b; }
    function ensureBuilt() { PLAN.pages.forEach(p => { if (!BUILT.has(p.id)) buildPage(p); }); }
    function rebuildBuilt() { PLAN = E.plan(CFG); BUILT.forEach((b, id) => { const p = PLAN.pages.find(x => x.id === id); if (p) buildPage(p); }); renderKpis(); renderLedger(); if (SEL) openPage(SEL, true); }
    $('#f9Build', root).onclick = () => { const t0 = performance.now(); PLAN.pages.forEach(p => buildPage(p)); renderKpis(); renderLedger(); $('#f9BuildNote', root).textContent = `Built and linted ${PLAN.pages.length} pages in ${Math.round(performance.now() - t0)} ms.`; if (!SEL && PLAN.pages.length) openPage(PLAN.pages[0].id); };
    function renderKpis() {
      const P0 = PLAN.pages; const bs = P0.map(p => BUILT.get(p.id)).filter(Boolean); const by = k => P0.filter(p => p.kind === k).length; const ms = PLAN.markets;
      const fx = ms.map(c => E.cityExtra(c));
      $('#f9Kpis', root).innerHTML = kpiHTML([
        { l: 'Pages planned', v: N(P0.length), d: `${by('practice')} service · ${by('city')} city · ${by('event')} event · ${by('landing')} landing · ${by('guide')} guides${by('county') ? ' · ' + by('county') + ' county' : ''}${by('region') ? ' · ' + by('region') + ' region' : ''}` },
        { l: 'Cities in the plan', v: N(ms.length), d: ms.slice(0, 4).map(c => c.name).join(', ') + (ms.length > 4 ? ' and ' + (ms.length - 4) + ' more' : '') },
        { l: 'Roofs 20 years or older in their ZIPs', g: 'B', v: K(sum(fx.map(x => x.ra20))), d: `${P(100 * sum(fx.map(x => x.ra20)) / META.ra20, 0)} of the state's modeled total · ${K(sum(fx.map(x => x.wave)))} more within five years` },
        { l: 'Gross profit pool a year', g: 'D', v: MM(sum(ms.map(c => c.fees))), d: `${P(100 * sum(ms.map(c => c.fees)) / META.fees_tot, 0)} of the statewide pool, in the plan's cities` },
        { l: 'Built', v: `${N(bs.length)} of ${N(P0.length)}`, d: bs.length ? `${N(sum(bs.map(b => b.words)))} words` : 'press Build all pages' },
        { l: 'Blocking checks', v: N(sum(bs.map(b => b.ch.block))), d: `${N(sum(bs.map(b => b.ch.warn)))} warnings · ${N(sum(bs.map(b => b.ch.note)))} notes` },
        { l: 'Internal links', v: N(sum(bs.map(b => b.bp.page.internal_links.length))), d: LIVE.items.length ? `from ${N(LIVE.items.length)} live URLs` : 'none until live URLs are pasted' }]); }
    function renderLedger() {
      const t = $('#f9LType', root).value, q = $('#f9LSearch', root).value.trim().toLowerCase(), showRem = $('#f9LRem', root).checked;
      const rows = PLAN.pages.concat(showRem ? PLAN.removed.map(p => Object.assign({ _rem: true }, p)) : []).filter(p => (!t || p.kind === t) && (!q || (p.label + ' ' + p.slug + ' ' + (p.city || '') + ' ' + (p.line || '') + ' ' + (p.event || '')).toLowerCase().includes(q)));
      const host = $('#f9Ledger', root); host._st = host._st || { k: 'n', dir: 1 };
      const idx = new Map(PLAN.pages.map((p, i) => [p.id, i]));
      dataTable(host, [{ k: 'n', h: '#', v: p => idx.has(p.id) ? idx.get(p.id) + 1 : 999, f: v => v === 999 ? '' : v }, { k: 'kind', h: 'Type', l: 1, v: p => E.KL[p.kind] }, { k: 'label', h: 'Page', l: 1, f: (v, p) => esc(v) + (p.lang === 'es' ? ' <span class="pill">ES</span>' : '') + (p._rem ? ' <span class="pill">removed</span>' : '') + (CFG.edits[p.id] ? ' <span class="pill">edited</span>' : '') }, { k: 'slug', h: 'Slug', l: 1, f: v => `<span class="mono" style="font-size:11px">/${esc(v)}/</span>` },
        { k: 'tl', h: 'Title', v: p => p.title.length, f: v => `<span style="color:${v > 60 ? 'var(--critical)' : 'inherit'}">${v}</span>` }, { k: 'ml', h: 'Meta', v: p => p.meta.length, f: v => `<span style="color:${v > 158 || v < 70 ? 'var(--judg)' : 'inherit'}">${v}</span>` },
        { k: 'w', h: 'Words', v: p => (BUILT.get(p.id) || {}).words, f: v => isN(v) ? N(v) : '·' }, { k: 'b', h: 'Blocks', v: p => ((BUILT.get(p.id) || {}).ch || {}).block, f: v => isN(v) ? (v ? `<b style="color:var(--critical)">${v}</b>` : '0') : '·' }, { k: 'wa', h: 'Warn', v: p => ((BUILT.get(p.id) || {}).ch || {}).warn, f: v => isN(v) ? v : '·' },
        { k: 'lk', h: 'Links', v: p => { const b = BUILT.get(p.id); return b ? b.bp.page.internal_links.length : null; }, f: v => isN(v) ? v : '·' }, { k: 'st', h: 'Deploy', l: 1, v: p => (DEPLOYED.get(p.id) || {}).status || '', f: v => v ? `<span class="pill">${esc(v)}</span>` : '' }],
        rows, { id: p => p.id, rowClass: p => p.id === SEL ? 'sel' : '', onClick: id => { const p = PLAN.removed.find(x => x.id === id); if (p) { delete CFG.removed[id]; save(); replan(); toast('Restored ' + p.label); return; } openPage(id); } });
      if (!rows.length) host.innerHTML = '<p class="mini">No pages match.</p>'; }
    ['#f9LType', '#f9LSearch', '#f9LRem'].forEach(s => $(s, root).addEventListener('input', renderLedger));

    /* ---------- studio ---------- */
    function closeStudio() { SEL = null; $('#f9StHead', root).textContent = 'Select a page in the ledger.'; $('#f9StPane', root).innerHTML = ''; $('#f9Checks', root).innerHTML = '<span class="mini">No page open.</span>'; $('#f9Facts', root).innerHTML = ''; $('#f9Links', root).innerHTML = ''; }
    function counters() { const t = $('#f9StTitle', root).value.length, h = $('#f9StH1', root).value.length, m = $('#f9StMeta', root).value.length; $('#f9StTitleC', root).textContent = `${t} of 60`; $('#f9StTitleC', root).style.color = t > 60 ? 'var(--critical)' : ''; $('#f9StH1C', root).textContent = `${h} of 70`; $('#f9StH1C', root).style.color = h > 70 ? 'var(--critical)' : ''; $('#f9StMetaC', root).textContent = `${m}, aim 120 to 158`; $('#f9StMetaC', root).style.color = m < 120 || m > 158 ? 'var(--judg)' : ''; }
    ['#f9StTitle', '#f9StH1', '#f9StMeta'].forEach(s => $(s, root).addEventListener('input', counters));
    function openPage(id, quiet) {
      const p = PLAN.pages.find(x => x.id === id); if (!p) return; SEL = id; const b = BUILT.get(id) || buildPage(p);
      $('#f9StHead', root).innerHTML = `<b>${esc(E.KL[p.kind])}</b> · ${esc(p.label)} · <span class="mono">/${esc(p.slug)}/</span> · ${N(b.words)} words${b.override ? ' · <span class="pill">edited blueprint</span>' : ''}`;
      $('#f9StTitle', root).value = p.title; $('#f9StH1', root).value = p.h1; $('#f9StSlug', root).value = p.slug; $('#f9StMeta', root).value = p.meta; counters();
      renderPane(); const ch = b.ch;
      $('#f9Checks', root).innerHTML = ch.issues.length ? ch.issues.map(i => `<div class="issue ${i.sev}"><b>${esc(i.sev.toUpperCase())} · ${esc(i.id)}</b> ${esc(i.msg)}${i.ev ? ` <span class="mini">${esc(i.ev)}</span>` : ''}<br><span class="mini">${esc(i.where)}${i.cite ? ' · ' + esc(i.cite) : ''}${i.fix ? ' · ' + esc(i.fix) : ''}</span></div>`).join('') : '<div class="msg ok">No findings. The page passes the Compliance Satchel rule pack, the house style and the compiler checks.</div>';
      $('#f9Facts', root).innerHTML = (b.bp._facts || []).length ? b.bp._facts.map(f => `<div class="rowl"><span>${esc(f.value)} <span class="mini">${esc(f.label)}</span><br><span class="mini">${esc(f.source)}</span></span><b>${G(f.grade)}</b></div>`).join('') : '<span class="mini">This page states no atlas figures.</span>';
      const L = b.bp.page.internal_links || []; $('#f9Links', root).innerHTML = L.length ? L.map(l => `<div class="rowl"><span>${esc(l.anchor)}</span><span class="mini mono">${esc(l.url)}</span></div>`).join('') : `<span class="mini">${LIVE.items.length ? 'No live URL matches this page.' : 'None: paste the live sitemap in step 4.'}</span>`;
      renderLedger(); if (!quiet) $('#f9Studio', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function renderPane() {
      const host = $('#f9StPane', root); if (!SEL) { host.innerHTML = ''; return; } const b = BUILT.get(SEL); if (!b) return;
      $$('#f9StTabs button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === TAB)));
      if (TAB === 'preview' || TAB === 'mobile') { host.innerHTML = `<div style="${TAB === 'mobile' ? 'max-width:400px;margin:0 auto' : ''}"><iframe class="prev" sandbox="allow-same-origin" title="Page preview" style="${TAB === 'mobile' ? 'height:760px' : ''}"></iframe></div>`; $('iframe', host).srcdoc = b.r.preview.replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, ''); return; }
      if (TAB === 'blueprint') { const bp = Object.assign({}, b.bp); delete bp._facts; delete bp._missing; host.innerHTML = `<textarea class="code" id="f9BpTxt" style="min-height:520px">${esc(JSON.stringify(bp, null, 1))}</textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="f9BpUse">Use edited blueprint</button><button class="btn sec sm" id="f9BpDrop">Back to the generated blueprint</button><span class="mini" id="f9BpMsg"></span></div>`;
        $('#f9BpUse', host).onclick = () => { let o; try { o = JSON.parse($('#f9BpTxt', host).value); } catch (e) { $('#f9BpMsg', host).textContent = 'Not valid JSON: ' + e.message; return; } o._facts = b.bp._facts; o._missing = []; b.override = o; const p = PLAN.pages.find(x => x.id === SEL); buildPage(p); openPage(SEL, true); toast('Edited blueprint compiled'); };
        $('#f9BpDrop', host).onclick = () => { b.override = null; const p = PLAN.pages.find(x => x.id === SEL); buildPage(p); openPage(SEL, true); }; return; }
      const txt = TAB === 'elementor' ? JSON.stringify(b.r.template, null, 1) : TAB === 'schema' ? JSON.stringify(b.r.schema, null, 1) : b.r.html;
      host.innerHTML = `<pre style="max-height:640px">${esc(txt)}</pre><div style="margin-top:8px"><button class="btn sec sm" id="f9Copy">Copy</button></div>`; $('#f9Copy', host).onclick = () => copyText(txt);
    }
    wireSeg($('#f9StTabs', root), v => { TAB = v; renderPane(); });
    $('#f9StApply', root).onclick = () => { if (!SEL) return; const ed = { title: houseClean($('#f9StTitle', root).value.trim()), h1: houseClean($('#f9StH1', root).value.trim()), slug: slug($('#f9StSlug', root).value.trim()), meta: houseClean($('#f9StMeta', root).value.trim()) }; Object.keys(ed).forEach(k => { if (!ed[k]) delete ed[k]; }); CFG.edits[SEL] = ed; const b = BUILT.get(SEL); if (b) b.override = null; save(); replan(); openPage(SEL, true); toast('Edits applied; they survive a full rebuild'); };
    $('#f9StReset', root).onclick = () => { if (!SEL) return; delete CFG.edits[SEL]; const b = BUILT.get(SEL); if (b) b.override = null; save(); replan(); openPage(SEL, true); };
    $('#f9StRemove', root).onclick = () => { if (!SEL) return; CFG.removed[SEL] = 1; BUILT.delete(SEL); save(); const l = (PLAN.pages.find(p => p.id === SEL) || {}).label; closeStudio(); replan(); toast('Removed ' + (l || 'page') + '; tick "Show removed pages" to restore it'); };
    const selB = () => SEL ? BUILT.get(SEL) : null;
    const stripBp = bp => { const o = Object.assign({}, bp); delete o._facts; delete o._missing; return o; };
    $('#f9StBp', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.blueprint.json', JSON.stringify(stripBp(b.bp), null, 1)); };
    $('#f9StEl', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.elementor-template.json', JSON.stringify(b.r.template)); };
    $('#f9StHtml', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.preview.html', b.r.preview); };
    $('#f9StBundle', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.bundle.json', JSON.stringify(FC.bundle(stripBp(b.bp), {}, FC.compile(stripBp(b.bp), {})))); };

    /* ---------- media ---------- */
    const drop = $('#f9Drop', root), fileIn = $('#f9File', root);
    drop.onclick = () => fileIn.click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } };
    drop.ondragover = e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; }; drop.ondragleave = () => drop.style.borderColor = '';
    drop.ondrop = e => { e.preventDefault(); drop.style.borderColor = ''; addFiles([...e.dataTransfer.files]); }; fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
    async function addFiles(files) {
      for (const f of files) { try { const stem = f.name.replace(/\.[^.]+$/, ''); const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(); let rec;
        if (f.type.startsWith('image/') && !/svg|gif/.test(f.type)) { let bmp; try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(f); } const r = Math.min(1, 1920 / Math.max(bmp.width, bmp.height)); const w = Math.round(bmp.width * r), h = Math.round(bmp.height * r); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h); const blob = await new Promise(res => cv.toBlob(res, 'image/webp', 0.82)); const webp = blob && blob.type === 'image/webp'; rec = { kind: 'image', blob: blob || f, w, h, mime: webp ? 'image/webp' : f.type, file: slug(stem) + (webp ? '.webp' : ext) }; }
        else rec = { kind: f.type.startsWith('video/') ? 'video' : 'image', blob: f, mime: f.type, file: slug(stem) + ext };
        rec.id = 'a' + Math.random().toString(36).slice(2, 9); rec.name = f.name; rec.size = rec.blob.size; rec.url = URL.createObjectURL(rec.blob); rec.alt = ''; ASSETS.push(rec); } catch (e) { console.warn('asset', f.name, e); toast('Could not read ' + f.name); } }
      save(); renderMedia(); rebuildBuilt(); }
    function assignOptions(cur) { const cities = PLAN.markets.map(c => c.name); const fips = [...new Set(PLAN.markets.map(c => E.HZ.COUNTIES[c.pi] ? E.HZ.COUNTIES[c.pi].fips : '').filter(Boolean))];
      const opts = [['', 'Unassigned'], ['default', 'Site default hero'], ['author', 'Qualifying individual headshot']].concat(Object.keys(E.KL).map(k => ['kind:' + k, 'All ' + E.KL[k].toLowerCase() + ' pages'])).concat(fips.map(f => ['county:' + f, (E.HZ.COUNTY_BY_FIPS[f] || {}).name + ' County pages'])).concat(cities.map(c => ['city:' + c, c + ' pages']));
      if (SEL) opts.push(['page:' + SEL, 'The page open in the studio']);
      return opts.map(o => `<option value="${esc(o[0])}" ${cur === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join(''); }
    function renderMedia() { const asg = CFG.media.assign; const rev = {}; for (const k in asg) rev[asg[k]] = k;
      $('#f9MediaTbl tbody', root).innerHTML = ASSETS.map(a => `<tr><td class="l">${a.kind === 'image' ? `<img src="${a.url}" alt="" style="width:72px;height:48px;object-fit:cover;border-radius:6px">` : '<span class="pill">video</span>'}</td><td class="l">${esc(a.file)}${a.w ? ` <span class="mini">${a.w} × ${a.h}</span>` : ''}</td><td>${N(a.size / 1024)} KB</td><td class="l"><select data-as="${a.id}">${assignOptions(rev[a.id] || '')}</select></td><td class="l"><input type="text" data-alt="${a.id}" value="${esc(a.alt || '')}" placeholder="what the photo shows" style="min-width:200px"></td><td><button class="btn ghost sm" data-del="${a.id}">Remove</button></td></tr>`).join('') || `<tr><td colspan="6" class="l mini">No assets yet. Photos are not saved with the plan; add them again after a reload.</td></tr>`;
      $$('#f9MediaTbl select[data-as]', root).forEach(s => s.onchange = () => { const id = s.dataset.as; for (const k in asg) if (asg[k] === id) delete asg[k]; if (s.value) asg[s.value] = id; save(); rebuildBuilt(); });
      $$('#f9MediaTbl input[data-alt]', root).forEach(i => i.onchange = () => { const a = ASSETS.find(x => x.id === i.dataset.alt); if (a) { a.alt = houseClean(i.value.trim()); i.value = a.alt; } rebuildBuilt(); });
      $$('#f9MediaTbl [data-del]', root).forEach(b => b.onclick = () => { const id = b.dataset.del; const a = ASSETS.find(x => x.id === id); if (a) URL.revokeObjectURL(a.url); ASSETS = ASSETS.filter(x => x.id !== id); for (const k in asg) if (asg[k] === id) delete asg[k]; save(); renderMedia(); rebuildBuilt(); }); }

    /* ---------- deploy ---------- */
    const WP = { base() { return ($('#f9dUrl', root).value || S().cms || S().url || '').trim().replace(/\/+$/, ''); }, auth() { return btoa(unescape(encodeURIComponent($('#f9dUser', root).value.trim() + ':' + $('#f9dPass', root).value.trim()))); },
      async req(method, path, body, raw) { const h = { Authorization: 'Basic ' + this.auth() }; if (body && !raw) h['Content-Type'] = 'application/json'; if (raw) { h['Content-Type'] = raw.mime; h['Content-Disposition'] = `attachment; filename="${raw.name}"`; }
        const r = await fetch(this.base() + '/wp-json/' + path.replace(/^\//, ''), { method, headers: h, body: body ? (raw ? body : JSON.stringify(body)) : undefined, mode: 'cors', credentials: 'omit' });
        let j = null; try { j = await r.json(); } catch (e) { } if (!r.ok) { const er = new Error((j && (j.message || j.code)) || ('HTTP ' + r.status)); er.status = r.status; throw er; } return j; } };
    const dlog = t => { const e = $('#f9dStatus', root); e.textContent = (e.textContent === 'Not connected.' ? '' : e.textContent + '\n') + t; e.scrollTop = e.scrollHeight; };
    $('#f9dTest', root).onclick = async () => { if (!WP.base()) { WPSTAT = null; $('#f9dGo', root).disabled = true; $('#f9dStatus', root).textContent = ''; $('#f9dCors', root).hidden = true; $('#f9dNote', root).textContent = 'Enter the WordPress URL first (or the public site URL in step 1).'; toast('Enter the WordPress URL first'); return; } $('#f9dNote', root).textContent = 'Testing…'; $('#f9dCors', root).hidden = true; $('#f9dStatus', root).textContent = '';
      try { const core = await (await fetch(WP.base() + '/wp-json/', { mode: 'cors' })).json(); dlog(`Site: ${core.name || '?'}. REST reachable. Namespaces: ${(core.namespaces || []).filter(n => /wp\/v2|forge|elementor/.test(n)).join(', ')}`);
        if ((core.namespaces || []).includes('forge/v1')) { const s = await WP.req('GET', 'forge/v1/status'); WPSTAT = Object.assign({ bridge: true }, s); dlog(`Bridge ${s.forge} · WP ${s.wp} · PHP ${s.php} · Elementor ${s.elementor || 'none'} · containers ${s.containers ? 'on' : 'off'} · theme ${s.theme}\nSEO plugin: ${s.seo_plugin} · unfiltered_html ${s.unfiltered_html ? 'yes' : 'no, Elementor data cannot be written'} · user ${s.user}`); }
        else { const me = await WP.req('GET', 'wp/v2/users/me?context=edit'); WPSTAT = { bridge: false, user: me.slug }; dlog(`No FORGE bridge on this site. Signed in as ${me.slug}. Without the bridge only the HTML fallback and media can be sent, with no Elementor data, JSON-LD or SEO fields.`); }
        $('#f9dNote', root).textContent = 'Connected.'; $('#f9dGo', root).disabled = false; ['#f9dLinks', '#f9dIdx', '#f9dLive'].forEach(s => $(s, root).disabled = !WPSTAT.bridge);
      } catch (e) { WPSTAT = null; $('#f9dGo', root).disabled = true; $('#f9dNote', root).textContent = 'Failed.'; dlog('Error: ' + (e.message || e)); if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/.test(String(e))) { $('#f9dCors', root).hidden = false; $('#f9dOrigin', root).textContent = location.origin; } } };
    async function wpFind(q) { try { if (WPSTAT && WPSTAT.bridge) return await WP.req('GET', 'forge/v1/media/find?q=' + encodeURIComponent(q) + '&per_page=5'); const rows = await WP.req('GET', 'wp/v2/media?search=' + encodeURIComponent(q) + '&per_page=5&_fields=id,source_url,mime_type,alt_text,media_details'); return rows.map(r => ({ id: r.id, url: r.source_url, mime: r.mime_type, alt: r.alt_text || '', width: (r.media_details || {}).width, height: (r.media_details || {}).height })); } catch (e) { return []; } }
    async function wpUpload(a, alt) { const stem = a.file.replace(/\.[^.]+$/, ''); const hit = (await wpFind(stem)).find(m => m.url && m.url.split('/').pop().replace(/\.[^.]+$/, '').startsWith(stem)); if (hit) return Object.assign({ reused: true }, hit);
      const j = await WP.req('POST', 'wp/v2/media', a.blob, { mime: a.mime, name: a.file }); try { await WP.req('POST', 'wp/v2/media/' + j.id, { alt_text: alt || a.alt || '', title: stem.replace(/-/g, ' ') }); } catch (e) { } const det = j.media_details || {}; return { id: j.id, url: j.source_url, width: det.width || a.w, height: det.height || a.h, mime: j.mime_type }; }
    async function resolveMedia(bp, notes) { const out = {}; const doMedia = $('#f9dMedia', root).checked;
      for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || '';
        if (/^https?:/.test(src) && spec.kind === 'video') { out[k] = { id: 0, url: src, alt: spec.alt, kind: 'video' }; continue; }
        if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (!a) { notes.push(k + ': asset not loaded'); continue; } if (!doMedia) { notes.push(k + ': upload skipped'); continue; } try { if (!a.remote) a.remote = await wpUpload(a, a.alt || spec.alt); out[k] = Object.assign({}, a.remote, { alt: a.alt || spec.alt, kind: a.kind }); } catch (e) { notes.push(k + ': upload failed, ' + e.message); } continue; }
        if (src.startsWith('library:') && doMedia) { const m = (await wpFind(src.slice(8))).find(h => !h.mime || h.mime.startsWith(spec.kind === 'video' ? 'video' : 'image')); if (m) out[k] = { id: m.id, url: m.url, alt: spec.alt || m.alt, kind: spec.kind || 'image', width: m.width, height: m.height }; else notes.push(k + ': no library match for "' + src.slice(8) + '"'); } }
      return out; }
    $('#f9dGo', root).onclick = () => { if (!WPSTAT) return; ensureBuilt(); renderLedger(); if ($('#f9dPublish', root).checked && !PUBLISH_OK) { $('#f9dConfirmT', root).textContent = `Publish ${PLAN.pages.length} pages live on ${WP.base()}? Drafts are the safe default.`; $('#f9dConfirm', root).hidden = false; return; } deployAll(); };
    $('#f9dConfirmGo', root).onclick = () => { PUBLISH_OK = true; $('#f9dConfirm', root).hidden = true; deployAll(); };
    $('#f9dConfirmNo', root).onclick = () => { $('#f9dPublish', root).checked = false; $('#f9dConfirm', root).hidden = true; deployAll(); };
    async function deployAll() {
      const publish = $('#f9dPublish', root).checked && PUBLISH_OK; const btn = $('#f9dGo', root); btn.disabled = true; const tb = $('#f9dRes tbody', root); tb.innerHTML = ''; const onlyNew = $('#f9dOnlyNew', root).checked; let done = 0;
      const todo = PLAN.pages.filter(p => !(onlyNew && DEPLOYED.has(p.id) && DEPLOYED.get(p.id).id));
      for (const p of todo) { const b = BUILT.get(p.id) || buildPage(p); const notes = []; const row = el('tr', null, `<td class="l">${esc(p.label)}</td><td class="l">…</td><td class="l"></td><td class="l"></td><td></td><td class="l"></td>`); tb.appendChild(row);
        try { if (b.ch.block) throw new Error('blocked by the checks: ' + [...new Set(b.ch.issues.filter(i => i.sev === 'block').map(i => i.id))].join(', '));
          const bp = stripBp(b.bp); const mp = await resolveMedia(bp, notes); const un = Object.keys(bp.media || {}).filter(k => !mp[k]); if (un.length) throw new Error('media unresolved: ' + un.join(', ') + '. Add an asset or a matching library image');
          const r = FC.compile(bp, mp); if (r.lint.some(l => /^BLOCK/.test(l))) throw new Error(r.lint.find(l => /^BLOCK/.test(l)));
          let res; if (WPSTAT.bridge) { const bundle = FC.bundle(bp, mp, r); bundle.status = publish ? 'publish' : 'draft'; res = await WP.req('POST', 'forge/v1/import', bundle); }
          else { const pt = bp.page.post_type === 'post' ? 'posts' : 'pages'; const ex = await WP.req('GET', `wp/v2/${pt}?slug=${encodeURIComponent(p.slug)}&status=any&_fields=id`); const body = { slug: p.slug, title: p.h1, status: publish ? 'publish' : 'draft', content: r.html, excerpt: bp.page.summary || '' }; const j = await WP.req('POST', ex.length ? `wp/v2/${pt}/${ex[0].id}` : `wp/v2/${pt}`, body); res = { id: j.id, link: j.link, edit: WP.base() + '/wp-admin/post.php?post=' + j.id + '&action=edit', status: body.status, updated: !!ex.length }; }
          DEPLOYED.set(p.id, { id: res.id, link: res.link, edit: res.edit, status: res.status || (publish ? 'publish' : 'draft'), note: notes.join('; ') });
          row.children[1].innerHTML = `<span class="pill">${esc(res.status || 'draft')}${res.updated ? ' · updated' : ''}</span>`; row.children[2].innerHTML = `<a href="${esc(res.link)}" target="_blank" rel="noopener">${esc(res.link)}</a>`; row.children[3].innerHTML = res.edit ? `<a href="${esc(res.edit)}" target="_blank" rel="noopener">Edit</a>` : ''; row.children[4].textContent = Object.keys(mp).length; row.children[5].textContent = notes.join('; ');
        } catch (e) { DEPLOYED.set(p.id, { status: 'error', note: e.message }); row.children[1].innerHTML = '<span class="pill">error</span>'; row.children[5].textContent = e.message + (notes.length ? ' · ' + notes.join('; ') : ''); }
        done++; }
      btn.disabled = false; renderLedger(); dlog(`Processed ${done} pages${publish ? ', publishing' : ' as drafts'}.`); }
    $('#f9dLive', root).onclick = async () => { try { const j = await WP.req('GET', 'forge/v1/urls'); const txt = (j.urls || []).join('\n'); $('#f9Live', root).value = txt; S().live = txt; LIVE = E.parseLive(txt, S().url); save(); renderLive(); rebuildBuilt(); dlog(`Live URLs refreshed from the site: ${j.count || (j.urls || []).length}.`); } catch (e) { dlog('Could not read live URLs: ' + e.message); } };
    $('#f9dLinks', root).onclick = async () => { try { const j = await WP.req('GET', 'forge/v1/urls'); const live = new Set((j.urls || []).map(u => { try { return new URL(u).pathname.replace(/\/?$/, '/'); } catch (e) { return u; } })); let bad = 0, tot = 0; PLAN.pages.forEach(p => { const b = BUILT.get(p.id); if (!b) return; b.bp.page.internal_links.forEach(l => { tot++; if (!live.has(l.url.replace(/\/?$/, '/'))) bad++; }); }); dlog(`Live URLs on the site: ${live.size}. Internal links in the plan: ${tot}; not live: ${bad}${bad ? '. Refresh the live URLs and rebuild before publishing' : ''}.`); } catch (e) { dlog('Link check failed: ' + e.message); } };
    $('#f9dIdx', root).onclick = async () => { const urls = [...DEPLOYED.values()].filter(d => d.status === 'publish' && d.link).map(d => d.link); if (!urls.length) { dlog('Nothing published yet.'); return; } try { const j = await WP.req('POST', 'forge/v1/indexnow', { urls }); dlog(`IndexNow: ${j.sent} URLs sent, response ${j.code}.`); } catch (e) { dlog('IndexNow failed: ' + e.message + '. Set an IndexNow key in the bridge settings first.'); } };

    /* ---------- exports ---------- */
    const ymd = () => new Date().toISOString().slice(0, 10);
    function cliText() { const site = S().url || 'https://www.example.com'; const first = PLAN.pages[0] ? PLAN.pages[0].slug : 'home';
      return `export WP_URL=${S().cms || site} WP_USER=<user> WP_APP_PASS='<application password>'
python3 forge_wp.py status
python3 forge_wp.py bridge-zip
for f in pack/blueprints/*.blueprint.json; do s=$(basename $f .blueprint.json); python3 forge_wp.py media-resolve $f pack/media/$s.media.json --assets pack --reuse && python3 forge_compile.py $f out --media pack/media/$s.media.json && python3 forge_wp.py links-check $f --base ${site} && python3 forge_wp.py import out/$s.bundle.json --media pack/media/$s.media.json; done
# one page: python3 forge_compile.py pack/blueprints/${first}.blueprint.json out`; }
    const csvRow = a => a.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',');
    function ledgerCSV() { ensureBuilt(); return '﻿' + ['type,label,slug,title,title_len,h1,meta,meta_len,words,blocks,warnings,internal_links,deploy_status,link'].concat(PLAN.pages.map(p => { const b = BUILT.get(p.id); const d = DEPLOYED.get(p.id) || {}; return csvRow([E.KL[p.kind], p.label, '/' + p.slug + '/', p.title, p.title.length, p.h1, p.meta, p.meta.length, b.words, b.ch.block, b.ch.warn, b.bp.page.internal_links.length, d.status || '', d.link || '']); })).join('\n'); }
    async function assetBytes(a) { return new Uint8Array(await a.blob.arrayBuffer()); }
    $('#f9Pack', root).onclick = async () => { ensureBuilt(); renderKpis(); renderLedger(); const files = []; const planJ = { v: 1, saved: new Date().toISOString(), cfg: CFG, pages: PLAN.pages.map(p => ({ id: p.id, kind: p.kind, slug: p.slug, title: p.title, h1: p.h1, meta: p.meta, label: p.label, lang: p.lang })) };
      files.push({ name: 'pack/plan.json', data: JSON.stringify(planJ, null, 1) });
      files.push({ name: 'pack/README.md', data: `# Site Forge pack\n\n${PLAN.pages.length} pages for ${S().brand || E.PH.brand}, built ${ymd()} by California Roofer Guru, module 09.\n\nFolders: blueprints (source of truth), bundles (what the bridge imports, media unresolved), elementor (templates for Templates, Saved Templates, Import), html (semantic fallback), preview (open in a browser), schema (JSON-LD), assets (WebP images and video), media (per page media maps to fill). forge-bridge.php is the WordPress plugin.\n\nInternal links point only at URLs that were live on the pasted sitemap. Re-run links-check before publishing. Pages with a blocking check in ledger.csv must be fixed in the studio first.\n\n\`\`\`\n${cliText()}\n\`\`\`\n` });
      files.push({ name: 'pack/forge-bridge.php', data: FORGE_BRIDGE_PHP }); files.push({ name: 'pack/ledger.csv', data: ledgerCSV() });
      for (const p of PLAN.pages) { const b = BUILT.get(p.id); const bp = stripBp(b.bp); files.push({ name: `pack/blueprints/${p.slug}.blueprint.json`, data: JSON.stringify(bp, null, 1) }); const r0 = FC.compile(bp, {}); files.push({ name: `pack/bundles/${p.slug}.bundle.json`, data: JSON.stringify(FC.bundle(bp, {}, r0)) }); files.push({ name: `pack/elementor/${p.slug}.elementor-template.json`, data: JSON.stringify(r0.template) }); files.push({ name: `pack/html/${p.slug}.content.html`, data: r0.html }); files.push({ name: `pack/preview/${p.slug}.preview.html`, data: r0.preview }); files.push({ name: `pack/schema/${p.slug}.schema.json`, data: JSON.stringify(r0.schema, null, 1) }); files.push({ name: `pack/media/${p.slug}.media.json`, data: '{}' }); }
      for (const a of ASSETS) files.push({ name: 'pack/assets/' + a.file, data: await assetBytes(a) });
      saveFile(`site-forge-pack_${slug(S().brand || 'company')}_${ymd()}.zip`, zipBlob(files)); };
    $('#f9ElZ', root).onclick = () => { ensureBuilt(); saveFile('site-forge-elementor-templates.zip', zipBlob(PLAN.pages.map(p => ({ name: `elementor/${p.slug}.elementor-template.json`, data: JSON.stringify(BUILT.get(p.id).r.template) })))); };
    $('#f9BpZ', root).onclick = () => { ensureBuilt(); saveFile('site-forge-blueprints.zip', zipBlob(PLAN.pages.map(p => ({ name: `blueprints/${p.slug}.blueprint.json`, data: JSON.stringify(stripBp(BUILT.get(p.id).bp), null, 1) })))); };
    $('#f9Bridge', root).onclick = () => saveFile('forge-bridge.zip', zipBlob([{ name: 'forge-bridge/forge-bridge.php', data: FORGE_BRIDGE_PHP }]));
    $('#f9LedX', root).onclick = () => saveFile('site-forge-ledger.csv', ledgerCSV());
    $('#f9Save', root).onclick = () => { readSite(); readFocus(); saveFile(`site-forge-plan_${slug(S().brand || 'company')}.json`, JSON.stringify({ v: 1, saved: new Date().toISOString(), cfg: CFG, deployed: [...DEPLOYED.entries()] }, null, 1)); };
    $('#f9Load', root).onclick = () => $('#f9LoadF', root).click();
    $('#f9LoadF', root).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await f.text()); CFG = merge(E.defaultCfg(), o.cfg || o); if (o.deployed) DEPLOYED = new Map(o.deployed); LIVE = E.parseLive(CFG.site.live, CFG.site.url); BUILT = new Map(); writeSite(); syncFocus(); $('#f9Live', root).value = CFG.site.live || ''; renderLive(); save(); replan(); toast('Plan loaded'); } catch (err) { toast('Not a Site Forge plan: ' + err.message); } e.target.value = ''; };

    /* ---------- method ---------- */
    function renderMethod() {
      const V = E.baseVars(CFG, PLAN.markets);
      const rows = E.FACT_KEYS.map(k => E.factItem(k, V)).filter(Boolean).map(f => [esc(f.value), esc(f.label), esc(f.source), esc(f.date), G(f.grade)]);
      rows.push(['per city', 'one unit roofs, roofs 20 years or older and reaching 20 within five years, the share of land in High or Very High Fire Hazard Severity Zones, structures destroyed or damaged by wildfire, days a year with gusts of 58 mph or more, normal rainfall, FAIR Plan residential policies, FEMA registrations and the energy climate zone, summed or averaged over its ZIP codes', 'Census ACS 2020 to 2024; the atlas roof age model; CAL FIRE zone maps and damage inspections; airport station records; California FAIR Plan; OpenFEMA', esc(String(META.compiled || '')), G('A/B')],
        ['per county and per region', 'the same figures over the county\'s or the region\'s ZIP codes', 'the same sources', esc(String(META.compiled || '')), G('A/B')],
        ['per event', 'wildfires: acres, structures destroyed and damaged, and the count inside the plan\'s ZIP codes; atmospheric rivers: strength at landfall; wind events: highest gust reported; homes in the ZIP codes reached', 'CAL FIRE perimeters and damage inspections; the CW3E landfall catalog; NOAA Storm Events', 'event ledger', G('A/B')]);
      $('#f9Method', root).innerHTML = `<div class="grid2"><div>${judgList([
        ['Pages', 'Each page is a FORGE blueprint: one JSON document naming the archetype, the RoofingContractor entity with the CSLB license as its identifier and CA as its region, the call to action and form, the media slots and an ordered list of sections. The same blueprint compiles to Elementor flex containers, semantic HTML and JSON-LD here and in the FORGE skill\'s Python compiler.'],
        ['Copy', 'Service copy is written per line, the same thirteen lines the Campaign Desk advertises, around the work, the signs owners see and the California rules that apply, with every statement of law carrying its citation. City, county, region and event pages are written from that place\'s own roof stock, fire zone share, fire record, wind and rain figures and FAIR Plan count; guides from the roof age model, the energy and fire codes and the law evidence.'],
        ['Standard', 'Title of 60 characters or fewer, meta of 120 to 158, one H1 of 70 or fewer, an answer capsule under the hero, sourced key facts, a FAQ of real questions, a primary call to action with the phone, a sticky mobile bar, a consent form with an unchecked box, and a notice on every page with the company name, the CSLB license number and the office.'],
        ['Links', 'Internal links come only from the live URLs pasted in step 4, scored by how well the path matches the page\'s service line and city. Pages in the plan link to each other only after they are live. Breadcrumbs name Home only when the home page is on the live list.'],
        ['Checks', 'Every text field runs the Compliance Satchel rule pack (CSLB licensing and the license number, the home improvement contract and down payment rules, Penal Code 551 on deductibles, the public adjuster act on claims, insurance discount and certification claims, financing disclosures, FTC review and "free" rules) and the house style; the page source runs the web rules. A block stops deploy here and in module 16.'],
        ['Data seams', 'Every data column this module reads is named in one block at the top of its source (HZ). A hazard column that is not in the data file yet drops its sentence and its fact; the page still builds and says nothing about that hazard.']])}</div>
        <div><div class="xscroll"><table class="prose"><thead><tr><th>Value</th><th>Fact as printed</th><th>Source printed on the page</th><th>Date</th><th>Grade</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>
        ${callout('judg', 'Judgment calls to check before publishing', judgList([
          ['No company is assumed', 'The forge opens brand neutral. Until the company name, the CSLB license number and an office city are set, pages read "Your company", "[license number]" and "Your city" and every page blocks. Nothing is filled from a competitor or a sample company.'],
          ['The license goes on every page', 'A licensed contractor must put the license number in all forms of advertising (Bus. & Prof. Code 7030.5), so it prints in the trust strip, the notice and the schema. C-39 covers roofing on homes and commercial buildings alike; the solar page asks who holds the C-10 or C-46 license for the panels.'],
          ['No claims, coverage or deductible language', 'Pages say what a roofer does: inspect, document with photos, write an itemized estimate and do the work. They never say what a policy covers, never offer to negotiate a claim (that takes a public adjuster license, Ins. Code 15006) and never offer anything toward a deductible (Penal Code 551). That a roofer may meet the adjuster on the roof at the owner\'s request is our reading of those sections, not a line drawn in a statute; have counsel confirm it.'],
          ['No insurance promises', 'The Safer from Wildfires rule sets no discount percentage, so no page states one for an insurer. The only percentage printed is the FAIR Plan\'s own published maximum for all twelve of its measures, labeled as that. No page says a roof will get a policy written, renewed or repriced.'],
          ['Permits are local', 'California has no statewide rule that every reroof needs a permit. Pages say the city or county decides and name the two written rules that were read (Los Angeles County and the City of San Diego). Check the rule for each market city before promising a permit.'],
          ['Cancellation rights', 'Pages state three business days, five for a senior citizen and seven for repairs after a declared emergency (Bus. & Prof. Code 7159, Civ. Code 1689.6). The age that makes a buyer a senior citizen was not read; the pages do not state one.'],
          ['Modeled numbers say so', 'Roof ages are the atlas\'s estimates and print with "by our estimate" and the method as the source. The fire zone share is a share of ZIP land, not of homes. Gust days come from the nearest long record station, which may sit miles away. FEMA counts only people who applied for federal help.'],
          ['Service lives are national guideline figures', 'No field study of shingle, membrane, metal or coating life in California was found. The pages print a national study and an inspectors\' guideline table and say so; the tile underlayment figure of about 25 years is one consultant\'s planning number. No coating life is printed.'],
          ['Event pages', 'A wildfire of the last six years gets a page on inspection and rebuilding with the disaster contract rules; a wildfire of 13 to 24 years ago gets a page on rebuilt homes whose roofs are one age, which is our inference and not a measured fact. Fires before 2013 carry no structure count. Atmospheric river and wind pages state strength and homes reached, never a count of roofs damaged: no damage model exists for them.'],
          ['No reviews, ratings or results by default', 'The forge writes no review, rating, review count or job result. Customer statements you paste print with a note that they describe one job, and the schema carries no aggregateRating (16 CFR Part 465).'],
          ['Click every citation once', 'Statute links point to the Legislature\'s site, regulations to a public transcription, and the Energy Code to the Energy Commission\'s file; the evidence was read on November 19, 2026 from archive captures and transcriptions because the official pages block automated readers. Title 24 building code citations carry no link. Open each link in a browser before publishing.'],
          ['Counts are by ZIP code, not city limits', 'City figures sum the city\'s ZIP codes, which reach past city limits, and the pages say "in the Sacramento ZIP codes".'],
          ['Spanish pages need a Spanish speaker', 'Spanish landing pages say "Hablamos español". Tick them only if someone at the company speaks Spanish with customers. The threshold defaults to 15 percent Spanish at home, because 8 percent would add a Spanish page for nearly every California city. The data also carries Chinese, Vietnamese, Tagalog and Korean shares; pages in those languages are not written.'],
          ['Manufactured homes', 'Which agency issues a roof permit for a manufactured home was not in the evidence, so the page tells the owner to ask and states no rule.'],
          ['Conservative page count', 'Eight cities plus the office city, at most two events, county and region hubs off and the per city guide off. Templated location pages are the pattern search engines treat as doorways; add places only where the numbers differ.'],
          ['Landing pages are noindex', 'Campaign landing pages duplicate the city and service pages\' intent; they stay out of the index unless you untick the option.'],
          ['Slugs keep hyphens', 'URL slugs use hyphens as separators, which is how WordPress builds them; the only hyphens in visible copy are the ones in license classifications, which print as the Board writes them (C-39, C-10, C-46).']]))}
        ${callout('note', 'Hand off to the FORGE skill', `Download the pack, unzip it beside the FORGE toolkit and run the commands in its README, or paste them into a Claude session that has the forge skill: it resolves media, checks every internal link against the live sitemap, imports each page as a draft through the bridge and reports the links. The pack's plan.json reloads here with ⤒ Load.<pre style="margin-top:8px">${esc(cliText())}</pre>`)}
        <div class="dsec" style="margin-top:14px">Sources</div>${srcRows([
          ['Licensing and contracts', 'Contractors State License Board pages and bulletins; Business and Professions Code 7026 to 7159.14 (license threshold, license number, bond, workers compensation, home improvement contracts, down payments, salespeople)', 'A', 'read Nov 19, 2026', 'https://www.cslb.ca.gov/'],
          ['California statutes', 'Penal Code 396 and 551; Insurance Code 675.1, 678, 2051.5, 15006, 15007; Civil Code 896, 1689.6, 1797.91, 4720, 8200; Health and Safety Code 13132.7; Code of Civil Procedure 337.1, 337.15', 'A', 'read Nov 19, 2026', 'https://leginfo.legislature.ca.gov/'],
          ['Insurance rules', 'Fair Claims Settlement Practices Regulations (10 CCR 2695.5, 2695.7, 2695.9); Safer from Wildfires (10 CCR 2644.9); California Department of Insurance; California FAIR Plan Association key statistics and discount flyer', 'A', 'Sep to Nov 2026', 'https://www.insurance.ca.gov/'],
          ['Energy Code', '2025 Building Energy Efficiency Standards, Title 24 Part 6, sections 110.8, 140.3, 141.0, 150.1, 150.2, 180.2 (Energy Commission file CEC-400-2025-010-F)', 'A', 'in force Jan 1, 2026', 'https://www.energy.ca.gov/sites/default/files/2026-07/CEC-400-2025-010-F.pdf'],
          ['Fire and building codes', '2025 California Wildland Urban Interface Code (Title 24 Part 7) chapters 1 and 5; California Residential Code R908; California Building Code 1505 (read on a transcription host)', 'A', 'in force Jan 1, 2026', ''],
          ['Federal rules', 'FTC consumer reviews rule (16 CFR Part 465) and Regulation Z advertising (12 CFR 1026.24), on eCFR', 'A', '', 'https://www.ecfr.gov/'],
          ['Roof stock', 'Census ACS 2020 to 2024; American Housing Survey 2023; EIA Residential Energy Consumption Survey 2020 (roof material); the atlas roof age model (module 17)', 'A/B', '2020 to 2024', 'https://www.census.gov/programs-surveys/acs'],
          ['Fire', 'CAL FIRE Fire Hazard Severity Zones (2024 and 2025), damage inspections 2013 to 2025 and fire perimeters; Insurance Institute for Business and Home Safety, The 2025 LA Conflagrations', 'A/B', '2026', 'https://ibhs.org/2025laconflagrations/'],
          ['Weather', 'NOAA Storm Events Database for California; airport station gust and rain records; CW3E atmospheric river landfall catalog', 'A/B', '2026', 'https://www.ncei.noaa.gov/stormevents/'],
          ['FEMA', 'OpenFEMA Individuals and Households Program registrations, California disasters', 'A', '2026', 'https://www.fema.gov/about/openfema/data-sets'],
          ['Permits and prices', 'City of Los Angeles and San Francisco open permit data; BLS Producer Price Index (WPU1017); Census Building Permits Survey', 'A/B', 'Nov 2026', 'https://data.lacity.org/'],
          ['Schema', 'schema.org RoofingContractor', 'A', '', 'https://schema.org/RoofingContractor']])}`;
    }

    /* ---------- hooks ---------- */
    this.receive = p => { if (!p) return; let names = []; if (p.zips && p.zips.length) names = citiesFromZips(p.zips); if (p.cities && p.cities.length) names = p.cities.filter(n => E.CITY[n]);
      const notes = [];
      if (names.length) { CFG.focus.scope = 'pick'; CFG.focus.picks = names.slice(0, 24); notes.push(`${Math.min(24, names.length)} cities`); }
      if (p.line && FCOPY.AC[p.line]) { if (!CFG.build.lines.includes(p.line)) CFG.build.lines.push(p.line); CFG.build.landingLines = [p.line]; notes.push(lineName(p.line).replace(/\b[A-Z][a-z]+\b/g, w => w.toLowerCase()) + ' landing pages'); }
      /* an event arrives by id: the ledger sends a fire's id as p.fire beside its name in p.event */
      const pev = [p.fire, p.event, p.storm].map(x => x && typeof x === 'object' ? x.id : x).find(id => id && E.HZ.EVENT_BY_ID[id]); if (pev) { CFG.build.eventPages = true; const cur = E.chosenEvents(CFG, E.markets(CFG)); CFG.build.eventsAuto = false; CFG.build.events = [...new Set([pev].concat(cur))].slice(0, 6); notes.push('an event page for the ' + E.HZ.EVENT_BY_ID[pev].name); }
      if (notes.length) { syncFocus(); save(); replan(); toast('Received ' + notes.join(', ')); } };
    this.feed = () => { ensureBuilt(); return PLAN.pages.map(p => { const b = BUILT.get(p.id); return { label: `Site Forge · ${E.KL[p.kind]} · ${p.label}`, text: E.pageText(b.bp).map(x => x[1]).join('\n'), html: b.r.html + '\n' + JSON.stringify(b.r.schema), plat: 'web', page: true }; }); };
    this.onShow = () => { };
    /* ---------- hand off to module 16 (Publish): every built page as a portable page with its media, for any CMS ---------- */
    this.publishPages = () => { ensureBuilt(); return PLAN.pages.map(p => { const b = BUILT.get(p.id); const bp = stripBp(b.bp); const media = {}, forCompile = {};
        for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || '';
          if (/^https?:/.test(src)) { media[k] = forCompile[k] = { id: 0, url: src, alt: spec.alt || '', kind: spec.kind || 'video' }; }
          else if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (a) { forCompile[k] = { id: 0, url: a.url, alt: a.alt || spec.alt || '', kind: a.kind, width: a.w, height: a.h }; media[k] = Object.assign({}, forCompile[k], { mime: a.mime, asset: { blob: a.blob, file: a.file, mime: a.mime } }); } else media[k] = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image', missing: src }; }
          else if (src.startsWith('library:')) media[k] = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image', library: src.slice(8) }; }
        const r = FC.compile(bp, forCompile);
        const blocks = b.ch.issues.filter(i => i.sev === 'block').map(i => `BLOCK: ${i.id} ${i.msg}${i.ev ? ' (' + i.ev + ')' : ''}`);
        return CMS.pageFromForge(bp, r, media, { label: p.label, kind: E.KL[p.kind], forgeId: p.id, checks: b.ch, words: b.words, lint: (r.lint || []).concat(blocks) }); }); };
    this.publishAssets = () => ASSETS.slice();
    this.publishSite = () => Object.assign({}, S());

    /* ---------- boot ---------- */
    writeSite(); syncFocus(); $('#f9Live', root).value = S().live || ''; renderLive(); $('#f9dUrl', root).value = S().cms || S().url || '';
    replan(); renderMedia();
    PLAN.pages.forEach(p => buildPage(p)); renderKpis(); renderLedger(); if (PLAN.pages.length) { const first = PLAN.pages.find(p => p.kind === 'city') || PLAN.pages[0]; openPage(first.id, true); }
    BUS.on('theme', () => renderFocus());
    BUS.on('brand', () => { if (CFG.site.followBrand === false) return; E.syncBrand(CFG, false); writeSite(); save(); replan(); });
  }
});