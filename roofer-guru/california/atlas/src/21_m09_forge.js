/* ==== 21_m09_forge.js ==== */
/* ==== m09_forge ==== */
"use strict";
/* ============================ Module 9: Site Forge (Louisiana roofing) ============================ */
/* FORGE plans the page set from the atlas (markets, parishes, named storms, service lines), writes each page as a FORGE
   blueprint from FCOPY and the atlas numbers, lints it with the Compliance Satchel (LSLBC licensing and permits, the claims
   and deductible statutes, FTC rules, house style) and hands it to FORGE_COMPILE (Elementor, semantic HTML, JSON-LD,
   preview). Internal links come only from the live sitemap the user pastes. */
const FORGE = (() => {
  const C = FCOPY;
  const KL = { home: 'Home', about: 'About', practice: 'Service', parish: 'Parish hub', city: 'City', storm: 'Storm', landing: 'Landing', guide: 'Guide' };
  const LINES = PL.map(l => l.key);
  const LAB = k => (C.AC[k] && C.AC[k].label) || lineName(k);
  /* the lines as running text: "roof replacement, leak repair and storm damage" */
  const RUN = { replace: 'roof replacement', repair: 'leak repair', storm: 'storm damage', hail: 'hail damage', fortified: 'FORTIFIED roofs', metal: 'metal roofs', mh: 'mobile home roofs', mf: 'multifamily roofs', comm: 'commercial roofs', coat: 'roof coatings', newc: 'new construction roofing' };
  /* lower case for running text, keeping FORTIFIED, HOA and other capitals */
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
  const ymLong = ym => { const m = String(ym || '').match(/^(\d{4})-(\d{2})/); return m ? MONL[+m[2] - 1] + ' ' + m[1] : null; };
  function cleanInline(s) { const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/); return m[1] + houseClean(m[2]) + m[3]; }
  function cleanHTML(h) { return String(h).split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p : (p.trim() ? cleanInline(p) : p)).join(''); }
  const TEXT_KEYS = new Set(['eyebrow', 'lede', 'body', 'text', 'heading', 'caption', 'title', 'label', 'q', 'a', 'quote', 'role', 'value', 'source', 'anchor', 'description', 'transcript', 'link', 'name']);
  function cleanDeep(x, key) {
    if (typeof x === 'string') return key === 'html' ? cleanHTML(x) : TEXT_KEYS.has(key) ? houseClean(x) : x;
    if (Array.isArray(x)) return x.map(v => cleanDeep(v, key === 'rows' || key === 'columns' ? 'text' : key));
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = (k === 'url' || k === 'media' || k === 'id' || k === 'type') ? x[k] : cleanDeep(x[k], k); return o; }
    return x;
  }
  const OPT = new Set(['c_ageWhy', 'p_ageWhy']);   /* sentences that are blank on purpose where they do not apply */
  function fill(t, V, missing) {
    if (t == null || typeof t !== 'string') return t;
    return t.replace(/\{([a-zA-Z_]\w*)\}/g, (m, k) => { if (V[k] != null && V[k] !== '') return String(V[k]); if (OPT.has(k)) return ''; if (missing && !missing.includes(k)) missing.push(k); return ''; })
      .replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/^\s*[.,;]\s*/, '').trim();
  }
  function fillDeep(x, V, missing) { if (typeof x === 'string') return fill(x, V, missing); if (Array.isArray(x)) return x.map(y => fillDeep(y, V, missing)); if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = fillDeep(x[k], V, missing); return o; } return x; }
  const officeList = S => [S.city].concat(String(S.offices || '').split(/[,;]\s*/)).map(s => String(s || '').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const CUR = +String(META.compiled || new Date().toISOString()).slice(0, 4);
  const SPC0 = 1996, SPC1 = 2025;          /* the SPC report years behind the hail days a year columns (hd1, hd175) */

  /* ---------- statewide constants ---------- */
  const ST = (() => {
    const h1 = PTS.filter(p => ptHas(p, 'h1')); const bym = Array(12).fill(0); h1.forEach(p => { if (p.m >= 1 && p.m <= 12) bym[p.m - 1]++; });
    let best = -1, bi = 0; for (let i = 0; i < 12; i++) { const s3 = bym[i] + bym[(i + 1) % 12] + bym[(i + 2) % 12]; if (s3 > best) { best = s3; bi = i; } }
    const ts = DATA.ts || {}; const ppi = ts.ppi || {}; const last = a => a && a.length ? a[a.length - 1] : null;
    const yoyOf = a => { const L = last(a); if (!L) return null; const [y, m] = L[0].split('-'); const prev = (a || []).find(x => x[0] === (+y - 1) + '-' + m); return prev ? 100 * (L[1] / prev[1] - 1) : null; };
    const perm = ts.permits || {}; const pys = Object.keys(perm).map(Number).filter(isN); const py = pys.length ? Math.max(...pys) : null;
    const fy = (ts.fema_year || []).map(r => r[2]).filter(isN); const yrsP = PTS.map(p => p.y).filter(isN); const L = last(ppi.steel);
    return { h1: h1.length, h175: PTS.filter(p => ptHas(p, 'h175')).length, bym, peak: bym.indexOf(Math.max(...bym)), s0: bi, s1: (bi + 2) % 12, sSh: h1.length ? 100 * best / h1.length : null,
      steel: yoyOf(ppi.steel), ppiYM: L ? L[0] : null, permYear: py, permUnits: py != null ? (perm[py] || [])[1] : null,
      fema: sum(Z.map(z => z.fema_k)), fy0: fy.length ? Math.min(...fy) : 2004, fy1: fy.length ? Math.max(...fy) : CUR,
      py0: yrsP.length ? Math.min(...yrsP) : 2016, py1: yrsP.length ? Math.max(...yrsP) : CUR,
      storms: RT.filter(r => r.n34 > 0).length, ry0: Math.min(...RT.map(r => r.year)), ry1: Math.max(...RT.map(r => r.year)) };
  })();
  const AHSm = META.ahs || {};

  /* ---------- storms at a set of ZIPs (from the per ZIP footprints of module 02) ---------- */
  const stormOf = x => RTI[x.name + ' ' + x.year] || null;
  const stormLab = x => { const r = stormOf(x); return r ? stormName(r) : (x.kt >= 64 ? 'Hurricane ' : 'Tropical Storm ') + x.name; };
  function stormsAt(zs) {
    const m = {}; zs.forEach(z => (DATA.zstorm[z.zip] || []).forEach(([si, kt]) => { if (!(si in m) || kt > m[si]) m[si] = kt; }));
    return Object.entries(m).map(([si, kt]) => { const s = SIDS[+si] || []; const r = RTI[s[0] + ' ' + s[1]]; return { si: +si, name: s[0], year: s[1], month: r ? r.month : 6, kt }; })
      .filter(x => x.name && x.year >= ST.ry0).sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month) || b.kt - a.kt);
  }
  function stormSentence(fx, where) {
    const y0 = ST.ry0, a = fx.s64, b = fx.s50;
    if (a.length === 1) return `Since ${y0}, one storm brought modeled sustained winds of hurricane force, 74 mph or more, to ${where}: ${stormLab(a[0])} in ${a[0].year}.`;
    if (a.length) return `Since ${y0}, ${numW(a.length)} storms brought modeled sustained winds of hurricane force, 74 mph or more, to ${where}, most recently ${stormLab(a[0])} in ${a[0].year}.`;
    if (b.length === 1) return `Since ${y0}, one storm brought modeled sustained winds of 58 mph or more to ${where}, ${stormLab(b[0])} in ${b[0].year}, and none reached hurricane force there.`;
    if (b.length) return `Since ${y0}, ${numW(b.length)} storms brought modeled sustained winds of 58 mph or more to ${where}, most recently ${stormLab(b[0])} in ${b[0].year}, and none reached hurricane force there.`;
    const n = fx.storms.filter(x => x.kt >= 34).length;
    return n ? `Since ${y0}, ${numW(n)} named ${n === 1 ? 'storm' : 'storms'} brought tropical storm force winds to ${where}, none as strong as 58 mph sustained.` : `No named storm since ${y0} brought tropical storm force winds to ${where}.`;
  }
  function hailSentence(fx, where) {
    const a = fx.h1 ? `NOAA logged ${cnt(fx.h1)} ${fx.h1 === 1 ? 'report' : 'reports'} of hail 1 inch or larger in ${where} from ${ST.py0} to ${ST.py1}${fx.h175 ? `, ${cnt(fx.h175)} of them golf ball size or larger` : ''}.` : `NOAA logged no reports of hail 1 inch or larger in ${where} from ${ST.py0} to ${ST.py1}.`;
    return a + (isN(fx.hd1) && fx.hd1 >= 0.05 ? ` Within 25 miles, hail that size was reported on about ${D(fx.hd1, 1)} days a year from ${SPC0} to ${SPC1}.` : '');
  }
  /* where storms reset most roofs recently, say so beside the low share of old roofs */
  function ageWhy(fx) {
    if (!(isN(fx.ra20_sh) && fx.ra20_sh < 12)) return '';
    const rec = fx.s64.filter(x => CUR - x.year <= 8).slice(0, 3); if (!rec.length) return '';
    const yrs = rec.map(x => x.year); const span = Math.min(...yrs) === Math.max(...yrs) ? `in ${yrs[0]}` : `from ${Math.min(...yrs)} to ${Math.max(...yrs)}`;
    const who = rec.length === 1 ? stormLab(rec[0]) : rec.every(x => /^Hurricane /.test(stormLab(x))) ? 'Hurricanes ' + listAnd(rec.map(x => x.name)) : listAnd(rec.map(stormLab));
    return `Most roofs there are young because ${who} replaced so many of them ${span}.`;
  }
  const femaSentence = (n, where) => n > 0 ? `FEMA recorded ${N(n)} ${n === 1 ? 'registration' : 'registrations'} with roof damage or verified wind loss in ${where} from ${ST.fy0} to ${ST.fy1}. FEMA counts only people who applied for federal help, so the count understates the roofs damaged.` : `FEMA recorded no registrations with roof damage or verified wind loss in ${where} from ${ST.fy0} to ${ST.fy1}.`;

  /* ---------- places ---------- */
  function placeFx(zs) {
    const s = k => sum(zs.map(z => z[k]));
    const wm = k => { let a = 0, t = 0; zs.forEach(z => { if (isN(z[k]) && z.pop > 0) { a += z[k] * z.pop; t += z.pop; } }); return t ? a / t : null; };
    const roofs = s('roofs'), ra20 = s('ra20'); const st = stormsAt(zs);
    return { roofs, ra20, ra20_sh: roofs ? 100 * ra20 / roofs : null, wave: s('wave'), nxt: s('nxt'), h1: s('ev_h1'), h175: s('ev_h175'), w58: s('ev_w58'), torn: s('ev_t'), fema: s('fema_k'),
      hd1: wm('hd1'), span_sh: wm('span_sh'), mh: s('mh'), cru: s('cru'), storms: st, s64: st.filter(x => x.kt >= 64), s50: st.filter(x => x.kt >= 50) };
  }
  function cityExtra(c) { if (!c._fx) c._fx = placeFx((c.zips || []).map(z => ZI[z]).filter(Boolean)); return c._fx; }
  function parishExtra(pa) { if (!pa._fx) pa._fx = placeFx(Z.filter(z => z.pi === pa.i)); return pa._fx; }
  function office(cfg) {
    const S = cfg.site; const c = CITY[S.city] || null; let lat = null, lon = null;
    if (c) { lat = c.lat; lon = c.lon; } else if (S.zip && ZI[S.zip]) { lat = ZI[S.zip].lat; lon = ZI[S.zip].lon; } else if (isN(S.lat) && isN(S.lon)) { lat = +S.lat; lon = +S.lon; }
    if (!isN(lat) || !isN(lon)) { lat = 30.4515; lon = -91.1871; }
    return { c, lat, lon, set: !!S.city };
  }
  function distMi(c, cfg) { const o = office(cfg); return isN(c.lat) ? kmLL(o.lat, o.lon, c.lat, c.lon) / 1.609344 : 999; }
  const METRICS = {
    fees: ['Gross profit pool a year, all lines (model)', c => c.fees], ra20: ['Roofs 20 years or older (model)', c => cityExtra(c).ra20], wave: ['Roofs reaching 20 within five years (model)', c => cityExtra(c).wave],
    replace: ['Replacement jobs a year (model)', c => c.p_replace], storm: ['Storm damage jobs a year (model)', c => c.p_storm], hail: ['Hail jobs a year (model)', c => c.p_hail], repair: ['Repair jobs a year (model)', c => c.p_repair],
    metal: ['Metal roofing jobs a year (model)', c => c.p_metal], mh: ['Mobile home roof jobs a year (model)', c => c.p_mh], comm: ['Commercial, multifamily and coating jobs a year (model)', c => (c.p_comm || 0) + (c.p_coat || 0) + (c.p_mf || 0)],
    fema: [`FEMA roof and wind registrations, ${ST.fy0} to ${ST.fy1}`, c => cityExtra(c).fema], h1: [`Hail reports 1 inch or larger, ${ST.py0} to ${ST.py1}`, c => cityExtra(c).h1],
    roofs: ['One unit roofs', c => cityExtra(c).roofs], pop: ['Residents of its ZIP codes', c => c.pop],
  };
  function markets(cfg) {
    const f = cfg.focus;
    if (f.scope === 'pick') return f.picks.map(n => CITY[n]).filter(Boolean);
    let list = CITIES.filter(c => (c.pop || 0) >= f.minPop);
    if (f.scope === 'radius') list = list.filter(c => distMi(c, cfg) <= f.miles);
    if (f.scope === 'parish') list = list.filter(c => PA[c.pi] && f.parishes.includes(PA[c.pi].fips));
    const m = (METRICS[f.metric] || METRICS.fees)[1];
    const ranked = list.slice().sort((a, b) => (m(b) || 0) - (m(a) || 0)).slice(0, f.n);
    const home = CITY[cfg.site.city]; if (home && !ranked.includes(home) && list.includes(home)) ranked.push(home);
    return ranked;
  }
  /* ---------- storm pages: the named storms that did the most roof damage in the plan's ZIPs ---------- */
  const zipSet = ms => ms && ms.length ? new Set(ms.flatMap(c => c.zips || [])) : null;
  function stormLocal(label, ms) { const zs = zipSet(ms); return zs ? footStats(label, z => zs.has(z.zip)) : (RTS[label] || { est: 0, vmax: 0, hu50: 0, hu64: 0, n34: 0, n50: 0, n64: 0 }); }
  function stormOptions(ms) { return RT.map(r => [r, stormLocal(r.r, ms).est]).filter(x => x[1] >= 1).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]); }
  const stormAge = r => CUR - r.year;
  /* recent storms: damage that may still be on the roofs; wave storms: the roofs replaced after them are coming due */
  const angleOf = r => { const a = stormAge(r); return a <= 1 ? 'fresh' : a <= 6 ? 'recent' : a >= 13 && a <= 24 ? 'wave' : 'past'; };
  function chosenStorms(cfg, ms) {
    const B = cfg.build; if (!B.stormsAuto) return (B.storms || []).filter(r => RTI[r]);
    const opts = stormOptions(ms).filter(r => stormLocal(r.r, ms).est >= 50); const out = []; const take = r => { if (r && !out.includes(r.r)) out.push(r.r); };
    take(opts.find(r => angleOf(r) === 'fresh' || angleOf(r) === 'recent')); take(opts.find(r => angleOf(r) === 'wave')); opts.forEach(r => { if (out.length < 2) take(r); });
    return out;
  }
  function stormCityRows(label, ms) {
    const foot = stormFoot(SIDX[label]); const list = ms && ms.length ? ms : CITIES.filter(c => (c.pop || 0) >= 10000);
    return list.map(c => { let kt = 0, est = 0, roofs = 0; (c.zips || []).forEach(zz => { const z = ZI[zz]; if (!z) return; const k = foot[zz] || 0; kt = Math.max(kt, k); est += dmgShare(k) * (z.roofs || 0); roofs += z.roofs || 0; }); return { c, kt, est, roofs }; })
      .filter(x => x.kt >= 34).sort((a, b) => b.est - a.est || b.kt - a.kt);
  }
  const segOf = lines => ({ res: lines.some(k => RES_LINES.includes(k)), com: lines.some(k => COM_LINES.includes(k)) });
  const segText = lines => { const g = segOf(lines); return g.res && g.com ? 'homes and businesses' : g.com ? 'businesses and properties' : 'homes'; };

  function defaultCfg() {
    const b = BRAND; const firmSet = brandSet();
    const com = /commercial|building construction|sheet metal/i.test(b.licClass || '');
    const lines = ['replace', 'repair', 'storm', 'hail', 'metal'].concat(b.fortified ? ['fortified'] : []).concat(com ? ['comm', 'coat', 'mf'] : []);
    return {
      v: 1,
      site: { brand: b.name || '', url: b.url || (b.domain ? 'https://www.' + b.domain : ''), cms: '', phone: b.phone ? phoneFmt(b.phone) : '', email: b.email || '',
        lic: b.lic || '', licClass: b.licClass || '', contact: b.contact || '', contactRole: 'Qualifying party', contactBio: '', street: houseClean(String(b.street || '').replace(/\bSte\b\.?/i, 'Suite')), city: b.city || '', zip: b.zip || '', offices: b.offices || '', lat: b.lat, lon: b.lon,
        hours: houseClean(b.hours || ''), hoursEs: '', hoursSchema: '', warranty: b.warranty || '', financing: b.financing || '', certs: b.certs || '', fortified: b.fortified || '',
        entity: 'RoofingContractor', sameAs: Object.values(b.social || {}).filter(v => /^https?:/.test(String(v))).join(', '), primary: (b.colors || {}).primary || '#b0502a', accent: (b.colors || {}).accent || '#efc6ab', dark: (b.colors || {}).dark || '#1e2933', globals: true,
        font_heading: (b.fonts || {}).display || '', font_body: (b.fonts || {}).body || '', logo_url: b.logoUrl || '',
        form_provider: 'html', form_shortcode: '', cta_label: 'Book a roof inspection', cta_url: '#contact', template: 'default', trust: 'LSLBC license {lic} | Office in {officeCity} | {hours}',
        about: '', video_url: '', testimonials: '', sticky: true, noindex_landing: true, guides_as_posts: false, span: 8, live: '', followBrand: true },
      focus: { scope: b.city ? 'radius' : 'all', miles: 45, parishes: [], picks: [], metric: 'fees', n: 8, minPop: 10000 },
      build: { home: true, about: true, practice: true, parishes: false, cities: true, stormPages: true, landing: true, es: /spanish|espa/i.test(b.languages || ''), guides: true,
        lines, landingLines: ['replace', 'storm'], stormsAuto: true, storms: [], topics: ['age', 'storm', 'hail', 'license'].concat(b.fortified ? ['fortified'] : []) },
      media: { assets: [], assign: {} }, edits: {}, removed: {}, _firm: firmSet,
    };
  }
  /* pull the company fields from the Company panel (BRAND); force overwrites, otherwise only fills from non empty values */
  function syncBrand(cfg, force) {
    const b = BRAND, s = cfg.site; const set = (k, v) => { if (v != null && v !== '' && (force || s[k] !== v)) s[k] = v; };
    set('brand', b.name); set('lic', b.lic); set('licClass', b.licClass); set('contact', b.contact); set('phone', b.phone ? phoneFmt(b.phone) : ''); set('email', b.email); set('url', b.url || (b.domain ? 'https://www.' + b.domain : ''));
    set('street', b.street ? houseClean(String(b.street).replace(/\bSte\b\.?/i, 'Suite')) : ''); set('city', b.city); set('zip', b.zip); set('offices', b.offices); set('hours', b.hours ? houseClean(b.hours) : '');
    set('warranty', b.warranty); set('financing', b.financing); set('certs', b.certs); set('fortified', b.fortified); set('logo_url', b.logoUrl);
    if (b.colors) { set('primary', b.colors.primary); set('accent', b.colors.accent); set('dark', b.colors.dark); }
    if (b.fonts) { set('font_heading', b.fonts.display); set('font_body', b.fonts.body); }
    if (isN(b.lat) && isN(b.lon)) { s.lat = b.lat; s.lon = b.lon; }
    return cfg;
  }

  /* ---------- template values ---------- */
  function baseVars(cfg, plan) {
    const S = cfg.site; const B = cfg.build; const fort = META.fort || {};
    const V = { brand: S.brand || PH.brand, lic: S.lic || PH.lic, phone: phoneFmt(S.phone), hours: S.hours || '', hoursEs: S.hoursEs || '', officeCity: S.city || PH.city, state: 'Louisiana', contact: S.contact || '' };
    V.officeAddr = S.street ? `${S.street}, ${V.officeCity}, Louisiana ${S.zip || ''}`.trim() : `${V.officeCity}, Louisiana`;
    const others = officeList(S).slice(1);
    V.officeLine = (S.street ? `Our office is at ${S.street}, ${V.officeCity}, Louisiana ${S.zip || ''}`.trim() + '.' : `Our office is in ${V.officeCity}, Louisiana.`) + (others.length ? ` We also have ${others.length === 1 ? 'an office' : 'offices'} in ${listAnd(others)}.` : '');
    V.areaList = listAnd((plan || []).slice(0, 6).map(c => c.name)) || 'Louisiana';
    const lines = (B.lines || LINES).filter(k => C.AC[k]);
    V.lineList = listAnd((lines.length ? lines : LINES).map(k => RUN[k] || lc(LAB(k))));
    V.segText = segText(lines.length ? lines : LINES);
    V.hoursShort = (S.hours || '').split(',')[0]; V.hoursRest = (S.hours || '').split(',').slice(1).join(',').trim();
    Object.assign(V, { s_ra20: about(META.ra20), s_wave: about(META.wave), s_nxt: about(META.nxt), s_mh: about(META.mh), s_roofs: about(META.roofs),
      s_storms: N(ST.storms), s_fema: N(ST.fema), s_h1: N(ST.h1), s_h175: N(ST.h175), s_hailPeak: MONL[ST.peak], s_grant: M$(fort.grant || 10000),
      s_steelMove: isN(ST.steel) ? (ST.steel >= 0 ? 'rose ' : 'fell ') + P(Math.abs(ST.steel), 0) : null, s_ppiMonth: ymLong(ST.ppiYM), s_permits: isN(ST.permUnits) ? N(ST.permUnits) : null, s_permitYear: ST.permYear ? String(ST.permYear) : null,
      s_out: META.lic && META.lic.n ? P(100 * META.lic.out / META.lic.n, 0) : null });
    return V;
  }
  function parishVars(pa, V, plan) {
    if (!pa) return V; const px = parishExtra(pa);
    V.parish = pa.name; V.p_roofs = about(px.roofs); V.p_ra20 = about(px.ra20); V.p_wave = about(px.wave); V.p_fema = N(px.fema); V.p_h1 = N(px.h1); V.p_ageWhy = ageWhy(Object.assign({ ra20_sh: px.roofs ? 100 * px.ra20 / px.roofs : null }, px));
    V.p_stormSentence = stormSentence(px, `parts of ${pa.name} Parish`) + ' ' + femaSentence(px.fema, `${pa.name} Parish`);
    V.p_hailSentence = hailSentence(px, `${pa.name} Parish`);
    const inP = (plan || []).filter(c => c.pi === pa.i).map(c => c.name); const top = CITIES.filter(c => c.pi === pa.i).sort((a, b) => b.pop - a.pop).map(c => c.name);
    V.parishCities = listAnd((inP.length ? inP : top).slice(0, 6)) || `communities across ${pa.name} Parish`;
    return V;
  }
  function cityVars(c, V, cfg, plan) {
    const x = cityExtra(c); const S = cfg.site; const here = S.city && S.city === c.name; const where = `the ${c.name} ZIP codes`;
    V.city = c.name; V.cityFull = c.name + ', Louisiana';
    V.c_roofs = about(x.roofs); V.c_ra20 = about(x.ra20); V.c_ra20_sh = isN(x.ra20_sh) ? P(x.ra20_sh, 0) : null; V.c_wave = about(x.wave); V.c_ageWhy = ageWhy(x);
    V.c_fema = N(x.fema); V.c_h1 = N(x.h1); V.c_hd1 = isN(x.hd1) && x.hd1 >= 0.05 ? D(x.hd1, 1) : null;
    const L = x.s50[0]; V.c_lastYear = L ? String(L.year) : null; V.c_lastName = L ? stormLab(L) : null;
    V.c_stormSentence = stormSentence(x, where); V.c_hailSentence = hailSentence(x, where); V.c_femaSentence = femaSentence(x.fema, where);
    V.cityServe = here ? `Yes. Our office is here in ${c.name}, and we work on ${V.segText || 'homes'} across ${V.parish} Parish.` : `Yes. We work on ${V.segText || 'homes'} in ${c.name} and across ${V.parish} Parish from our office in ${V.officeCity}.`;
    const near = (plan || []).filter(p => p.name !== c.name).map(p => [p, kmLL(c.lat, c.lon, p.lat, p.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(p => p[0].name);
    const near2 = near.length >= 2 ? near : CITIES.filter(p => p.name !== c.name && p.pop >= 10000).map(p => [p, kmLL(c.lat, c.lon, p.lat, p.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(p => p[0].name);
    V.nearby = listAnd(near2);
    return V;
  }
  function stormVars(r, V, plan) {
    if (!r) return V; const loc = stormLocal(r.r, plan); const rows = stormCityRows(r.r, plan);
    V.st_name = stormName(r); V.st_year = String(r.year); V.st_month = MONL[(r.month || 1) - 1]; V.st_when = V.st_month + ' ' + r.year; V.st_age = String(stormAge(r));
    V.st_mph = N(ktMph(loc.vmax || r.vmax)); V.st_roofs = about(loc.est); V.st_hu64 = loc.hu64 ? about(loc.hu64) : null; V.st_hu50 = loc.hu50 ? about(loc.hu50) : null; V.st_fema = r.fema ? N(r.fema) : null;
    V.st_c0 = rows[0] ? rows[0].c.name : (V.officeCity !== PH.city ? V.officeCity : 'Louisiana'); V.st_c1 = rows[1] ? rows[1].c.name : '';
    V.st_area = V.st_c0 === 'Louisiana' ? 'Louisiana' : `${V.st_c0}${V.st_c1 ? ' and ' + V.st_c1 : ''} area`;
    return V;
  }
  function varsFor(p, cfg, plan) {
    const V = baseVars(cfg, plan); const o = office(cfg);
    if (p.city && CITY[p.city]) { const c = CITY[p.city]; parishVars(PA[c.pi], V, plan); cityVars(c, V, cfg, plan); }
    else if (p.fips && PAI[p.fips]) { parishVars(PAI[p.fips], V, plan); if (o.c) cityVars(o.c, V, cfg, plan); V.city = V.parish + ' Parish'; V.cityFull = V.parish + ' Parish, Louisiana'; }
    else { if (o.c) { parishVars(PA[o.c.pi], V, plan); cityVars(o.c, V, cfg, plan); } else { V.city = V.officeCity; V.cityFull = V.officeCity + ', Louisiana'; } }
    if (p.storm && RTI[p.storm]) stormVars(RTI[p.storm], V, plan);
    return V;
  }

  /* ---------- facts (public attribution on the page; the grade stays in the forge) ---------- */
  function factItem(k, V) {
    const SRC = { model: 'Estimate from Census American Community Survey 2020 to 2024 housing data, the 2023 American Housing Survey and NHC hurricane tracks',
      acs: 'U.S. Census Bureau, American Community Survey 2020 to 2024', noaa: `NOAA Storm Events Database, ${ST.py0} to ${ST.py1}`, noaaZ: `NOAA Storm Events Database, ${ST.py0} to ${ST.py1}, placed by coordinates`,
      spc: `NOAA Storm Prediction Center severe reports, ${SPC0} to ${SPC1}`, fema: `OpenFEMA Individuals and Households Program, ${ST.fy0} to ${ST.fy1}`, hurdat: 'NOAA National Hurricane Center best tracks (HURDAT2), winds modeled to ZIP codes',
      dmg: 'Estimate from modeled winds and a damage curve fitted to FEMA registrations', nahb: 'National Association of Home Builders, Study of Life Expectancy of Home Components',
      ind: 'Manufacturer warranty terms and industry estimates', ahs: 'U.S. Census Bureau, American Housing Survey 2023', bls: 'U.S. Bureau of Labor Statistics, Producer Price Index for steel mill products',
      bps: 'U.S. Census Bureau, Building Permits Survey', lslbc: 'Louisiana State Licensing Board for Contractors roster, October 2026', ldi: 'La. R.S. 22:1483.1; Louisiana Department of Insurance, Fortify Homes Program' };
    const ab = v => v ? 'About ' + v : null;
    const R = {
      s_ra20: [ab(V.s_ra20), 'one unit roofs in Louisiana are 20 years or older', 'model', 'B'], s_wave: [ab(V.s_wave), 'more Louisiana roofs reach 20 years old within five years', 'model', 'B'],
      s_nxt: [ab(V.s_nxt), 'Louisiana roofs due for replacement from age alone in the coming year', 'model', 'B'],
      life_fact: ['About 20 years', 'typical life of an asphalt shingle roof', 'nahb', 'B'],
      life_metal: ['40 years or more', 'common life of a metal roof, depending on the metal, the finish and salt exposure', 'ind', 'C'],
      life_comm: ['15 to 30 years', 'common life of a low slope commercial membrane, by system, thickness and drainage', 'ind', 'C'],
      life_coat: ['10 to 20 years', 'common warranty term of a commercial roof coating, by product and the thickness applied', 'ind', 'C'],
      permit_fact: ['Every reroof', 'needs a permit from the parish or city and its inspections, for work beginning on or after August 1, 2025', 'Acts 2025, No. 239', 'A'],
      lic7500: ['$7,500', 'residential roofing job size at which the Residential Roofing or Residential Construction license is required', 'La. R.S. 37:2156.4 (Acts 2026, No. 757)', 'A'],
      liab_fact: ['$500,000', 'liability coverage residential contractors must keep on file with the LSLBC', 'La. R.S. 37:2156.1', 'A'],
      comm_fact: ['$50,000', 'commercial job size at which a commercial license with the right classification is required', 'La. R.S. 37:2150.1 and following', 'A'],
      clock_fact: ['14 days', 'for an insurer to begin adjusting a property claim after notice, or 30 days after a catastrophic loss', 'La. R.S. 22:1892', 'A'],
      ded_fact: ['$1,000', 'contract size, paid from insurance, that must carry the statutory deductible notice in bold type', 'La. R.S. 51:452', 'A'],
      gouge_fact: ['Pre storm prices', 'apply while a state of emergency is declared, plus documented cost increases', 'La. R.S. 29:732', 'A'],
      lien_fact: ['Notice and filing', 'deadlines keep lien rights for contractors, subcontractors and suppliers on private works', 'La. R.S. 9:4801 and following', 'A'],
      nhwa_fact: ['1 year', 'builder warranty against defects from noncompliance with building standards, 5 years for major structural defects', 'La. R.S. 9:3141 and following', 'A'],
      grant_fact: [V.s_grant, 'top Louisiana Fortify Homes Program grant toward a FORTIFIED roof, drawn by lottery for eligible homes', 'ldi', 'A'],
      s_storms: [V.s_storms, `named storms brought tropical storm force winds to Louisiana, ${ST.ry0} to ${ST.ry1}`, 'hurdat', 'B'],
      s_fema: [V.s_fema, `FEMA registrations in Louisiana with roof damage or verified wind loss, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A'],
      s_h1: [V.s_h1, `reports of hail 1 inch or larger in Louisiana, ${ST.py0} to ${ST.py1}`, 'noaa', 'A'],
      s_h175: [V.s_h175, `reports of hail 1.75 inches or larger, golf ball size, in Louisiana, ${ST.py0} to ${ST.py1}`, 'noaa', 'A'],
      hail_season: [`${MONL[ST.s0]} to ${MONL[ST.s1]}`, `the months with ${P(ST.sSh, 0)} of Louisiana reports of hail 1 inch or larger, ${ST.py0} to ${ST.py1}`, 'noaa', 'A'],
      s_mh: [ab(V.s_mh), 'mobile and manufactured homes in Louisiana', 'acs', 'A'],
      mh_cost: [isN(AHSm.s_mh_med) ? 'About ' + M$(AHSm.s_mh_med) : null, 'median cost of a professional roof job on a mobile home in the South', 'ahs', 'B'],
      s_steel_fact: [isN(ST.steel) ? (ST.steel >= 0 ? 'Up ' : 'Down ') + P(Math.abs(ST.steel), 0) : null, `producer prices for steel mill products, the metal in roof panels and flashing, ${V.s_ppiMonth} against a year earlier`, 'bls', 'A'],
      s_permits_fact: [V.s_permits, `new housing units permitted in Louisiana in ${V.s_permitYear}`, 'bps', 'A'],
      s_out: [V.s_out, 'of roofing license records on the LSLBC roster belong to companies based outside Louisiana', 'lslbc', 'B'],
      c_roofs: [ab(V.c_roofs), `one unit roofs in the ${V.city} ZIP codes`, 'acs', 'A'], c_ra20: [ab(V.c_ra20), `one unit roofs in the ${V.city} ZIP codes are 20 years or older`, 'model', 'B'],
      c_h1: V.c_h1 && V.c_h1 !== '0' ? [V.c_h1, `reports of hail 1 inch or larger in the ${V.city} ZIP codes, ${ST.py0} to ${ST.py1}`, 'noaaZ', 'A'] : [V.c_hd1, `days a year with hail 1 inch or larger reported within 25 miles of ${V.city}, ${SPC0} to ${SPC1}`, 'spc', 'B'],
      c_fema: [V.c_fema, `FEMA registrations with roof damage or verified wind loss in the ${V.city} ZIP codes, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A'],
      c_last: [V.c_lastYear, `latest year a named storm brought sustained winds of 58 mph or more to the ${V.city} ZIP codes: ${V.c_lastName}`, 'hurdat', 'B'],
      p_roofs: [ab(V.p_roofs), `one unit roofs in ${V.parish} Parish`, 'acs', 'A'], p_ra20: [ab(V.p_ra20), `one unit roofs in ${V.parish} Parish are 20 years or older`, 'model', 'B'],
      p_fema: [V.p_fema, `FEMA registrations with roof damage or verified wind loss in ${V.parish} Parish, ${ST.fy0} to ${ST.fy1}`, 'fema', 'A'],
      p_h1: [V.p_h1, `reports of hail 1 inch or larger in ${V.parish} Parish, ${ST.py0} to ${ST.py1}`, 'noaaZ', 'A'],
      st_mph: [V.st_mph ? V.st_mph + ' mph' : null, `peak modeled sustained wind of ${V.st_name} in the ${V.st_area}, ${V.st_when}`, 'hurdat', 'B'],
      st_roofs: [ab(V.st_roofs), `roofs damaged by ${V.st_name} in the ${V.st_area}, by our estimate`, 'dmg', 'C'],
      st_hu64: [ab(V.st_hu64), `homes in ZIP codes where ${V.st_name} brought modeled hurricane force winds`, 'hurdat', 'B'],
      st_fema: [V.st_fema, `FEMA registrations in Louisiana with roof damage or verified wind loss after ${V.st_name}`, 'fema', 'A'],
    };
    const r = R[k]; if (!r || r[0] == null || r[0] === '—' || r[0] === '' || r[0] === '0' || /undefined|null|NaN/.test(String(r[0]) + r[1])) return null;
    return { key: k, value: String(r[0]), label: r[1], source: SRC[r[2]] || r[2], grade: r[3] };
  }

  /* ---------- plan ---------- */
  function plan(cfg) {
    const pages = []; const B = cfg.build; const ms = markets(cfg); const fipsOf = c => PA[c.pi] ? PA[c.pi].fips : '';
    const add = (kind, o) => { const p = Object.assign({ kind, lang: 'en' }, o); p.id = [kind, p.line || '', p.city || '', p.fips || '', p.storm || '', p.topic || '', p.lang].join('|'); pages.push(p); return p; };
    if (B.home) add('home', {});
    if (B.about) add('about', {});
    if (B.practice) (B.lines || []).filter(k => C.AC[k]).forEach(k => add('practice', { line: k }));
    const fipsIn = [...new Set(ms.map(fipsOf).filter(Boolean))];
    if (B.parishes) fipsIn.forEach(f => add('parish', { fips: f }));
    if (B.cities) ms.forEach(c => add('city', { city: c.name, fips: fipsOf(c) }));
    const storms = chosenStorms(cfg, ms);
    if (B.stormPages) storms.forEach(r => add('storm', { storm: r }));
    if (B.landing) ms.forEach(c => (B.landingLines || []).filter(k => C.AC[k]).forEach(k => { add('landing', { line: k, city: c.name, fips: fipsOf(c) }); if (B.es && (cityExtra(c).span_sh || 0) >= (+cfg.site.span || 8)) add('landing', { line: k, city: c.name, fips: fipsOf(c), lang: 'es' }); }));
    if (B.guides) { const G = C.GUIDES.filter(g => (B.topics || []).includes(g.id));
      G.filter(g => g.scope === 'state').forEach(g => add('guide', { topic: g.id }));
      G.filter(g => g.scope === 'city').forEach(g => ms.forEach(c => add('guide', { topic: g.id, city: c.name, fips: fipsOf(c) }))); }
    const seen = {}; pages.forEach(p => { Object.assign(p, describe(p, cfg, ms)); if (cfg.edits[p.id]) Object.assign(p, cfg.edits[p.id]); let s = p.slug, n = 2; while (seen[s]) s = p.slug + '-' + (n++); seen[s] = 1; p.slug = s; });
    return { pages: pages.filter(p => !cfg.removed[p.id]), removed: pages.filter(p => cfg.removed[p.id]), markets: ms, storms };
  }
  function fitMeta(s) { s = houseClean(s); if (s.length <= 158) return s; const cut = s.slice(0, 158); const i = cut.lastIndexOf('. '); return i >= 60 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, '') + '…'; }
  function fitTitle(t, brand) { t = houseClean(t); if (t.length > 60) t = t.replace(' | ' + houseClean(brand), ''); if (t.length > 60) t = t.replace(/\s[|:].*$/, ''); if (t.length > 60) t = t.slice(0, 60).replace(/\s\S*$/, ''); return t; }
  function describe(p, cfg, ms) {
    const V = varsFor(p, cfg, ms); const brand = V.brand; const d = {};
    switch (p.kind) {
      case 'home': d.label = 'Home'; d.slug = 'home'; d.h1 = `Roofing Contractor in ${V.officeCity}, Louisiana`; d.title = `${brand} | Roofing in ${V.officeCity}, LA`; d.meta = `Licensed roofing contractor in ${V.officeCity}, Louisiana, for ${V.segText}: itemized written estimates and a permit for every job. ${brand}, LSLBC license ${V.lic}.`; break;
      case 'about': d.label = 'About'; d.slug = 'about'; d.h1 = `About ${brand}`; d.title = `About ${brand} | Louisiana Roofing Contractor`; d.meta = `${brand} is a Louisiana roofing contractor with an office in ${V.officeCity}, LSLBC license ${V.lic}. Who we are, how we work and how to check our license.`; break;
      case 'practice': { const A = C.AC[p.line]; d.label = LAB(p.line); d.slug = A.slug; d.h1 = A.h1n; d.title = `${A.title} | ${brand}`; d.meta = fill(A.meta || A.lede, V); break; }
      case 'parish': d.label = `${V.parish} Parish`; d.slug = slug(V.parish) + '-parish-roofing'; d.h1 = `Roofing in ${V.parish} Parish, Louisiana`; d.title = `${V.parish} Parish Roofing | ${brand}`; d.meta = `Roofing for ${V.segText} in ${V.parish} Parish, where about ${V.p_ra20 || 'a fifth of the'} roofs are 20 years or older by our estimate. Office in ${V.officeCity}, Louisiana.`; break;
      case 'city': d.label = V.cityFull; d.slug = slug(V.city) + '-roofing'; d.h1 = `Roofing Contractor in ${V.city}, Louisiana`; d.title = `${V.city} Roofing Contractor | ${brand}`; d.meta = `Roofing for ${V.segText} in ${V.city} and across ${V.parish} Parish, with itemized written estimates and a permit for every job. Office in ${V.officeCity}.`; break;
      case 'storm': { const r = RTI[p.storm]; d.label = `${V.st_name} (${r.year})`; d.slug = slug(`${V.st_name} ${r.year} roof damage ${V.st_c0 === 'Louisiana' ? '' : V.st_c0}`); const h = `${V.st_name} Roof Damage in ${V.st_c0}${V.st_c1 ? ' and ' + V.st_c1 : ''}`; d.h1 = h.length <= 70 ? h : `${V.st_name} Roof Damage in ${V.st_c0}`; d.title = `${V.st_name} Roof Damage | ${V.st_c0}${V.st_c0 === 'Louisiana' ? '' : ', Louisiana'}`;
        const ang = angleOf(r); d.meta = ang === 'wave' ? `Roofs replaced after ${V.st_name} in ${r.year} are about ${V.st_age} years old now. What the storm did in the ${V.st_area} and what owners should check.` : ang === 'past' ? `What ${V.st_name} did to roofs in the ${V.st_area} in ${V.st_when}, and what it means for those roofs now.` : `What ${V.st_name} did to roofs in the ${V.st_area} in ${V.st_when}, the damage that can still be hiding, and what owners should check now.`; break; }
      case 'landing': { const A = C.AC[p.line], L = PLI[p.line], es = p.lang === 'es'; d.label = (es ? 'Spanish landing · ' : 'Landing · ') + L.short + ' · ' + V.city; d.slug = (es ? 'lp-es-' : 'lp-') + slug(L.short) + '-' + slug(V.city); d.h1 = es ? fill(A.es.h[0], V) : fill(A.h1, V); d.title = `${d.h1} | ${brand}`; d.meta = es ? fill(A.es.d[0], V) : fill(A.lp, V); break; }
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
    const w = t.split(/\s+/).map(x => ({ la: 'LA', faq: 'FAQ', hoa: 'HOA', tpo: 'TPO', pvc: 'PVC', epdm: 'EPDM', fortified: 'FORTIFIED', lslbc: 'LSLBC', fema: 'FEMA' }[x.toLowerCase()] || x.toLowerCase()));
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
  const TOK = { replace: ['roof-replacement', 'new-roof', 'reroof', 'replacement', 'shingle', 'shingles', 'residential-roofing'], repair: ['roof-repair', 'repair', 'repairs', 'leak', 'leaks', 'roof-leak'],
    storm: ['storm', 'storm-damage', 'wind', 'hurricane', 'tarp', 'tarping', 'emergency'], hail: ['hail', 'hail-damage', 'impact'], fortified: ['fortified', 'fortify', 'ibhs'],
    metal: ['metal', 'metal-roof', 'metal-roofing', 'standing-seam'], mh: ['mobile-home', 'manufactured', 'mobile', 'roof-over'], mf: ['multifamily', 'apartment', 'apartments', 'condo', 'hoa'],
    comm: ['commercial', 'commercial-roofing', 'flat-roof', 'tpo', 'pvc', 'low-slope'], coat: ['coating', 'coatings', 'restoration', 'silicone', 'maintenance'], newc: ['new-construction', 'builder', 'builders'],
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
    const g = p.kind === 'guide' ? C.GUIDES.find(x => x.id === p.topic) : null;
    const keys = p.kind === 'practice' ? (C.AC[p.line].related || []).concat(['contact'])
      : p.kind === 'storm' ? ['storm', 'repair', 'replace', 'fortified']
      : g ? (g.line ? [g.line].concat((C.AC[g.line] || {}).related || []) : ['replace', 'storm', 'repair'])
      : p.kind === 'about' ? ['contact'].concat(built.slice(0, 3)) : built.slice(0, 4);
    if (cityTok) live.items.filter(l => l.path.toLowerCase().includes(cityTok)).slice(0, 2).forEach(push);
    if (p.kind === 'storm' && RTI[p.storm]) stormCityRows(p.storm, ms).slice(0, 3).forEach(x => { const t = slug(x.c.name); push(live.items.find(l => l.path.toLowerCase().includes(t) && !used.has(l.path))); });
    keys.forEach(k => push(bestFor(live, k, cityTok, used)));
    return out;
  }

  /* ---------- blueprint ---------- */
  function entity(cfg, ms) {
    const S = cfg.site; const e = { '@type': S.entity || 'RoofingContractor', name: S.brand || PH.brand };
    const d = String(S.phone || '').replace(/\D/g, ''); if (d.length === 10) e.telephone = '+1' + d; else if (d) e.telephone = S.phone;
    if (S.email) e.email = S.email;
    if (S.street || S.city) e.address = { '@type': 'PostalAddress', streetAddress: S.street || undefined, addressLocality: S.city || undefined, addressRegion: 'LA', postalCode: S.zip || undefined, addressCountry: 'US' };
    const o = office(cfg); if (S.city && isN(o.lat)) e.geo = { '@type': 'GeoCoordinates', latitude: +(+o.lat).toFixed(5), longitude: +(+o.lon).toFixed(5) };
    if (S.hoursSchema) e.openingHours = S.hoursSchema;
    if (S.sameAs) e.sameAs = S.sameAs.split(/[\s,]+/).filter(Boolean);
    if (S.lic) e.identifier = { '@type': 'PropertyValue', propertyID: 'Louisiana State Licensing Board for Contractors license', value: S.lic };
    if (ms && ms.length) e.areaServed = ms.map(c => ({ '@type': 'City', name: c.name + ', LA' }));
    e.knowsAbout = (cfg.build.lines || LINES).filter(k => PLI[k]).map(k => LAB(k));
    return e;
  }
  function testimonials(cfg) { const t = (cfg.site.testimonials || '').trim(); if (!t) return null; const items = []; t.split(/\n+/).forEach(line => { const m = line.split('|').map(x => x.trim()); if (m[0]) items.push({ quote: m[0], name: m[1] || '', role: m[2] || '' }); }); return items.length ? items : null; }
  function mediaSpec(p, cfg, V) {
    const S = cfg.site; const m = {}; const asg = cfg.media.assign || {}; const assets = cfg.media.assets || []; const pick = key => { const id = asg[key]; return id ? assets.find(x => x.id === id) : null; };
    const a = pick('page:' + p.id) || pick('city:' + (p.city || '')) || pick('parish:' + (p.fips || '')) || pick('kind:' + p.kind) || pick('default');
    const brand = V.brand;
    const alt = houseClean(p.kind === 'city' || p.kind === 'landing' ? `${brand} roofing crew at work in ${V.city}, Louisiana` : p.kind === 'practice' ? `${LAB(p.line)}, ${brand}` : p.kind === 'parish' ? `${brand}, roofing in ${V.parish} Parish, Louisiana` : p.kind === 'storm' ? `Roof repair after ${V.st_name} in the ${V.st_area}` : `${brand}, roofing contractor in ${V.officeCity}, Louisiana`);
    const q = p.kind === 'city' || p.kind === 'landing' ? V.city + ' roof' : p.kind === 'practice' ? lc(PLI[p.line].name) : p.kind === 'parish' ? V.parish + ' parish' : p.kind === 'storm' ? 'storm damage roof' : 'roofing crew';
    if (p.kind !== 'guide') m.hero = { source: a ? 'assets/' + a.file : 'library:' + q, alt, kind: 'image', priority: true };
    const au = pick('author'); if (S.contact) m.author = { source: au ? 'assets/' + au.file : 'library:' + S.contact, alt: houseClean(`${S.contact}, ${brand}`), kind: 'image' };
    if (S.video_url && (p.kind === 'home' || p.kind === 'practice')) m.explainer = { source: S.video_url, alt: houseClean(`${brand}, how a roof inspection works`), kind: 'video' };
    return m;
  }
  function serviceItems(cfg, V, live, pages, only) {
    const ids = (only || cfg.build.lines || LINES).filter(k => C.AC[k]);
    return ids.slice(0, 11).map(k => { const pg = pages.find(q => q.kind === 'practice' && q.line === k); const own = pg && liveHas(live, '/' + pg.slug + '/') ? { path: '/' + pg.slug + '/' } : bestFor(live, k, null, null);
      return { title: LAB(k), text: fill(C.AC[k].card || firstSentence(C.AC[k].lede), V), url: own ? own.path : undefined, link: own ? 'Read more' : undefined }; });
  }
  function lawHTML(keys) {
    const e = FORGE_COMPILE.esc;
    return '<ul>' + keys.map(k => { const L = C.LAWPUB[k]; if (!L) return ''; const cite = L[3] && !/LawSearch/.test(L[3]) ? `<a href="${e(L[3])}" rel="noopener">${e(L[2])}</a>` : e(L[2]); return `<li><strong>${e(L[0])}.</strong> ${e(L[1])} <small>(${cite})</small></li>`; }).join('') + '</ul>';
  }
  const ES_ANS = { replace: 'replace', metal: 'replace', newc: 'replace', storm: 'storm', hail: 'storm', repair: 'repair', mh: 'repair' };
  function blueprint(p, cfg, pages, live, ms) {
    const S = cfg.site; const missing = []; const V = varsFor(p, cfg, ms); const es = p.lang === 'es';
    const A = p.line ? C.AC[p.line] : null; const brand = V.brand; const esc = FORGE_COMPILE.esc;
    const F = t => fill(t, V, missing), FD = x => fillDeep(x, V, missing);
    const used = []; const facts = keys => keys.map(k => factItem(k, V)).filter(Boolean).map(f => { used.push(f); return { value: f.value, label: f.label, source: f.source }; });
    const media = mediaSpec(p, cfg, V); const tst = testimonials(cfg); const today = new Date().toISOString().slice(0, 10);
    const internal = linksFor(p, live, '/' + p.slug + '/', cfg, ms);
    const crumbs = liveHas(live, '/') && p.kind !== 'home' && p.kind !== 'landing' ? [{ name: es ? C.ES.breadcrumbs : 'Home', url: '/' }] : [];
    const trust = (es ? C.ES.trust : String(S.trust || '').split('|')).map(x => fill(x.trim(), V)).filter(Boolean).slice(0, 3);
    const CTA_L = S.cta_label || 'Book a roof inspection';
    const form = { provider: S.form_provider || 'html', button: es ? C.ES.form.button : CTA_L, consent: fill(es ? C.ES.form.consent : C.CONSENT, V), fields: es ? C.ES.form.fields : C.FIELDS, success: es ? 'Gracias. Le llamamos pronto.' : 'Thanks. We will call you shortly to schedule the inspection.' };
    if (S.form_shortcode) form.shortcode = S.form_shortcode; if (S.email) form.email_to = S.email;
    const cta = { primary: { label: es ? C.ES.cta.label : CTA_L, url: S.cta_url || '#contact' }, secondary: { label: es ? 'Cómo trabajamos' : 'How it works', url: '#how-it-works' } };
    if (V.phone) { cta.primary.phone = V.phone; cta.primary.phone_label = es ? fill(C.ES.cta.phone_label, V) : 'Call ' + V.phone; }
    const page = { archetype: { home: 'home', about: 'about', practice: 'service', parish: 'location', city: 'location', storm: 'location', landing: 'landing', guide: 'article' }[p.kind], post_type: p.kind === 'guide' && S.guides_as_posts ? 'post' : 'page',
      slug: p.slug, title: p.title, h1: p.h1, meta_description: p.meta, language: es ? 'es-US' : 'en-US', template: p.kind === 'landing' ? (S.template === 'default' ? 'elementor_canvas' : S.template) : (S.template || 'default'),
      breadcrumbs: crumbs, summary: '', entity: entity(cfg, ms), dates: { published: today, modified: today }, cta, conversion: { sticky_mobile_bar: S.sticky !== false, trust, form }, internal_links: internal, schema_extra: [] };
    if (S.contact) page.author = { name: S.contact, credentials: `${S.contactRole || 'Qualifying party'}, ${brand}`, bio: S.contactBio || '', media: media.author ? 'author' : undefined };
    if (p.kind === 'landing' && S.noindex_landing) page.noindex = true;
    if (['practice', 'city', 'parish', 'storm'].includes(p.kind)) {
      const rt = p.storm ? RTI[p.storm] : null;
      page.service = { '@type': 'Service', serviceType: p.kind === 'practice' ? LAB(p.line) : 'Roofing',
        areaServed: p.kind === 'city' ? { '@type': 'City', name: V.city + ', LA' } : p.kind === 'parish' ? { '@type': 'AdministrativeArea', name: V.parish + ' Parish, LA' } : rt ? stormCityRows(rt.r, ms).slice(0, 8).map(x => ({ '@type': 'City', name: x.c.name + ', LA' })) : { '@type': 'State', name: 'Louisiana' } };
      if (Array.isArray(page.service.areaServed) && !page.service.areaServed.length) page.service.areaServed = { '@type': 'State', name: 'Louisiana' };
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
    const FORM_H = 'Book a roof inspection', FORM_T = 'Tell us about the roof and how to reach you. We call back to schedule the inspection.';
    const BAND_T = 'We inspect the roof, photograph what we find and give you an itemized written estimate.';
    const lines = (cfg.build.lines || LINES).filter(k => C.AC[k]);
    const licPara = () => `<p>${esc(brand)} holds Louisiana State Licensing Board for Contractors license ${esc(V.lic)}${S.licClass ? `, classified ${esc(houseClean(S.licClass))}` : ''}. You can confirm the license on the board's <a href="https://lslbc.gov/" rel="noopener">website</a> before you sign anything.</p>`;
    switch (p.kind) {
      case 'home': {
        page.summary = F('{brand}: roofing contractor with an office in {officeCity}, Louisiana, LSLBC license {lic}.');
        hero({ eyebrow: F('Roofing contractor · {officeCity}, Louisiana'), lede: F('Licensed Louisiana roofing for {segText}, with an itemized written estimate and a permit for every job.') });
        sec.push({ type: 'answer', heading: F('Who {brand} is'), body: S.about ? F(S.about) : F('{brand} is a roofing contractor with an office in {officeCity}, Louisiana, licensed by the Louisiana State Licensing Board for Contractors under license {lic}. Our work covers {lineList}. Every job gets an itemized written estimate, a permit from the parish or city and the inspections it requires.') });
        sec.push({ type: 'key_facts', heading: 'Louisiana roofs by the numbers', items: facts(['s_ra20', 's_wave', 's_storms', 'permit_fact']) });
        sec.push({ type: 'features', id: 'services', heading: 'Services', text: 'Each kind of roof work has its own page, its own rules and its own questions.', items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); video(); testi();
        sec.push({ type: 'faq', heading: 'Questions people ask before they call', items: FD(C.HOME_FAQ) });
        band(F('Book a roof inspection with {brand}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'about': {
        page.summary = F('About {brand}, a Louisiana roofing contractor.');
        hero({ eyebrow: brand, lede: F('A roofing contractor with an office in {officeCity}, Louisiana, licensed by the LSLBC under license {lic}.') });
        sec.push({ type: 'answer', heading: F('Who is {brand}?'), body: S.about ? F(S.about) : F('{brand} is a roofing contractor with an office in {officeCity}, Louisiana. ' + (S.contact ? '{contact} is the ' + lc(S.contactRole || 'qualifying party') + ' for the company. ' : '') + 'Our work covers {lineList}.') });
        sec.push({ type: 'key_facts', heading: 'At a glance', items: [{ value: V.lic, label: 'Louisiana State Licensing Board for Contractors license', source: brand }, { value: V.officeCity, label: 'office location', source: brand }].concat(S.contact ? [{ value: S.contact, label: lc(S.contactRole || 'qualifying party'), source: brand }] : []).concat(V.hoursShort ? [{ value: V.hoursShort, label: V.hoursRest || 'hours', source: brand }] : []) });
        sec.push({ type: 'rich_text', heading: 'How we work', html: '<p>Every job starts with an inspection and an itemized written estimate that lists the materials, the labor, the permit and any decking or ventilation work, so prices can be compared line by line. We pull the permit from the parish or city before work starts and pass the inspections it requires.</p>' + (S.warranty ? `<p>${esc(sent(F(S.warranty)))}</p>` : '') + (S.financing ? `<p>${esc(sent(F(S.financing)))}</p>` : '') });
        sec.push({ type: 'rich_text', heading: 'License, insurance and certifications', html: licPara() + '<p>Residential contractors licensed by the board keep at least $500,000 in liability coverage on file with it, and every roofing job in Louisiana needs a permit and inspections.</p>' + (S.certs ? `<p>Manufacturer certifications: ${esc(houseClean(S.certs))}.</p>` : '') + (S.fortified ? `<p>${esc(sent(S.fortified))}</p>` : '') });
        sec.push({ type: 'faq', heading: 'Questions people ask', items: FD(C.HOME_FAQ).slice(0, 5) });
        band(F('Book a roof inspection with {brand}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'practice': {
        page.summary = F(`${LAB(p.line)} from {brand}: `) + firstSentence(strip(F(A.answer)));
        hero({ eyebrow: F(A.eyebrow), lede: F(A.lede) });
        sec.push({ type: 'answer', heading: A.aq, body: F(A.answer) });
        sec.push({ type: 'key_facts', heading: 'The numbers and the rules', items: facts(A.facts) });
        sec.push({ type: 'rich_text', heading: 'What the work includes', html: F(A.what) });
        sec.push({ type: 'rich_text', heading: 'Before you hire a roofer', html: F(A.who) });
        sec.push({ type: 'rich_text', id: 'louisiana-law', heading: 'The Louisiana rules that apply', html: lawHTML(A.law) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS[A.steps]) }); video(); testi();
        sec.push({ type: 'faq', heading: `Questions about ${lc(LAB(p.line))}`, items: FD(A.faq) }); authors();
        band(F(A.band + '.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'parish': {
        const pa = PAI[p.fips];
        page.summary = F('{brand} for {parish} Parish: about {p_ra20} roofs there are 20 years or older by our estimate.');
        hero({ eyebrow: F('{brand} · {parish} Parish'), lede: F('Roofing for {segText} across {parish} Parish, from our office in {officeCity}.') });
        sec.push({ type: 'answer', heading: F('How old are the roofs in {parish} Parish?'), body: F('By our estimate from Census and storm records, about {p_ra20} one unit roofs in {parish} Parish are 20 years or older, out of about {p_roofs}, and {p_wave} more reach 20 within five years. {p_ageWhy} {p_stormSentence}') });
        sec.push({ type: 'key_facts', heading: F('{parish} Parish by the numbers'), items: facts(['p_roofs', 'p_ra20', 'p_fema', 'p_h1']) });
        const cs0 = ms.filter(c => c.pi === pa.i); const cs = cs0.concat(CITIES.filter(c => c.pi === pa.i && !cs0.includes(c)).sort((x, y) => y.pop - x.pop)).slice(0, 8);
        if (cs.length) sec.push({ type: 'table', heading: F('Roofs and storms in {parish} Parish communities'), columns: ['Community', 'One unit roofs', 'Roofs 20 years or older (estimate)', `Hail reports 1 inch or larger, ${ST.py0} to ${ST.py1}`, `FEMA roof and wind registrations, ${ST.fy0} to ${ST.fy1}`], rows: cs.map(c => { const zs = (c.zips || []).map(z => ZI[z]).filter(z => z && z.pi === pa.i); const t = k => sum(zs.map(z => z[k])); return [c.name, N(t('roofs')), N(roundNice(t('ra20'))), N(t('ev_h1')), N(t('fema_k'))]; }) });
        sec.push({ type: 'rich_text', heading: 'What the parish numbers show', html: `<p>${esc(F('{p_hailSentence}'))}</p><p>Every roof and reroof in the parish needs a permit from the parish or city and the inspections it requires, and residential roofing of $7,500 or more needs the LSLBC license.</p>` });
        sec.push({ type: 'features', id: 'services', heading: F('Roofing services in {parish} Parish'), items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); testi();
        sec.push({ type: 'faq', heading: F('Questions people in {parish} Parish ask'), items: FD(C.PARISH_FAQ) });
        band(F('Book a roof inspection in {parish} Parish.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'city': {
        const c = CITY[p.city]; const here = S.city && S.city === c.name;
        page.summary = F('{brand} for {city}: roofing for {segText} in {city} and {parish} Parish.');
        hero({ eyebrow: F('{brand} · {city}'), lede: F('Roofing for {segText} in {city} and across {parish} Parish, ' + (here ? 'from our office here in {city}.' : 'from our office in {officeCity}.')) });
        sec.push({ type: 'answer', heading: F('How old are the roofs in {city}, and what hits them?'), body: F('{brand} works on roofs in {city} and across {parish} Parish, ' + (here ? 'from our office here.' : 'from our office in {officeCity}.') + ' By our estimate, about {c_ra20_sh} of the one unit roofs in the {city} ZIP codes are 20 years or older, and {c_wave} more reach 20 within five years. {c_ageWhy} {c_stormSentence}') });
        sec.push({ type: 'key_facts', heading: F('{city} by the numbers'), items: facts(['c_roofs', 'c_ra20', 'c_h1', 'c_fema']) });
        sec.push({ type: 'rich_text', heading: F('Storms and hail in {city}'), html: `<p>${esc(F('{c_hailSentence}'))}</p><p>${esc(F('{c_femaSentence}'))}</p>` });
        sec.push({ type: 'features', id: 'services', heading: F('Roofing services in {city}'), items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(C.STEPS.replace) }); testi(F('What {city} customers say'));
        sec.push({ type: 'faq', heading: F('Questions people in {city} ask'), items: FD(C.CITY_FAQ) });
        band(F('Book a roof inspection in {city}.'), BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'storm': {
        const r = RTI[p.storm]; const ang = angleOf(r); const age = stormAge(r); const rows = stormCityRows(r.r, ms).filter(x => x.est >= 1).slice(0, 8);
        const zs = zipSet(ms); const huAll = zs ? sum([...zs].map(z => (ZI[z] || {}).hu || 0)) : 0; const loc = stormLocal(r.r, ms);
        page.summary = F('{st_name}, {st_when}: about {st_roofs} roofs damaged in the {st_area} by our estimate, and what owners should check now.');
        const lede = ang === 'fresh' ? 'Wind damage from {st_name} is not always visible from the ground. Here is what the storm did to roofs in the {st_area} and what to do now.'
          : ang === 'recent' ? 'Wind damage from {st_name} can still be on roofs that were never inspected closely. Here is what the storm did in the {st_area} and what to check now.'
          : ang === 'wave' ? (age >= 18 ? 'Roofs replaced after {st_name} in {st_year} are now about {st_age} years old, at or near the end of a shingle roof\'s life in Louisiana.' : 'Roofs replaced after {st_name} in {st_year} are now about {st_age} years old and reach twenty within ' + numW(20 - age) + ' years.')
          : 'What {st_name} did to roofs in the {st_area}, and what it means for those roofs now.';
        hero({ eyebrow: F('{st_name} · {st_when}'), lede: F(lede) });
        const hu = loc.hu64 && huAll && loc.hu64 >= 0.98 * huAll ? ' Every community in the area saw modeled hurricane force winds.' : V.st_hu64 ? ' ' + F('About {st_hu64} homes sat in ZIP codes that saw modeled hurricane force winds.') : '';
        sec.push({ type: 'answer', heading: F('What did {st_name} do to roofs in the {st_area}?'), body: F('{st_name} brought modeled sustained winds of up to about {st_mph} mph to the {st_area} in {st_when}. By our estimate from its modeled winds and FEMA damage records, it damaged about {st_roofs} roofs there badly enough to need replacing.') + hu + (V.st_fema ? ' ' + F('FEMA recorded {st_fema} Louisiana registrations with roof damage or verified wind loss after the storm.') : '') });
        sec.push({ type: 'key_facts', heading: F('{st_name} by the numbers'), items: facts(['st_mph', 'st_roofs', 'st_fema', ang === 'fresh' ? 'clock_fact' : ang === 'recent' ? 'permit_fact' : 'life_fact']) });
        if (rows.length) sec.push({ type: 'table', heading: F('Where {st_name} hit hardest in the area'), columns: ['Community', 'Peak sustained wind, mph (model)', 'One unit roofs', 'Roofs damaged (estimate)'], rows: rows.map(x => [x.c.name, N(ktMph(x.kt)), N(x.roofs), N(roundNice(x.est))]) });
        const WIND = 'Wind lifts and creases shingles and breaks their seal without tearing them off, and that damage often shows up later as leaks or as shingles lost in the next storm.';
        sec.push({ type: 'rich_text', heading: ang === 'fresh' || ang === 'recent' ? 'Damage that can still be there' : ang === 'wave' ? F('The roofs replaced after {st_name}') : 'What it means now',
          html: ang === 'fresh' ? `<p>${WIND} A roof that went through the storm without a close inspection is worth one now, slope by slope, with photos. If you reported damage, keep the claim number; your insurer decides coverage under your policy.</p><p>After notice, an insurer must begin adjusting a property claim within 14 days, or within 30 days after a catastrophic loss. A roofer may not interpret your policy, negotiate your claim or offer to take on any part of your deductible.</p>`
            : ang === 'recent' ? `<p>${WIND} ${esc(F('A roof that went through {st_name} without a close inspection is worth one now, slope by slope, with photos.'))}</p><p>Every reroof needs a permit from the parish or city and the inspections it requires, and residential roofing of $7,500 or more needs the LSLBC license. Get two itemized written estimates and compare them line by line.</p>`
            : ang === 'wave' ? `<p>${esc(F('{st_name} replaced roofs across the area in a few months, and those roofs have aged together since. Most Louisiana shingle roofs last about twenty years, so the roofs put on after the storm in {st_year} are now about {st_age} years old.'))} Curling or missing shingles, bare spots, granules in the gutters and new leaks are the signs that a roof is near its end.</p><p>Every reroof now needs a permit and inspections, and residential roofing of $7,500 or more needs the LSLBC license. Get two itemized written estimates and compare them line by line.</p>`
            : `<p>${esc(F('Roofs that came through {st_name} have since faced more summers and more storms. A roof near twenty years old, or one that went through the storm without a close inspection, is worth checking slope by slope before the next season.'))}</p><p>Every reroof needs a permit and inspections, and residential roofing of $7,500 or more needs the LSLBC license.</p>` });
        sec.push({ type: 'features', id: 'services', heading: 'Storm and replacement work we do', items: serviceItems(cfg, V, live, pages, ['storm', 'repair', 'replace', 'fortified', 'metal'].filter(k => lines.includes(k))) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How it works', steps: FD(ang === 'fresh' ? C.STEPS.storm : ang === 'recent' ? C.STEPS.repair : C.STEPS.replace) });
        sec.push({ type: 'faq', heading: ang === 'fresh' || ang === 'recent' ? F('Questions after {st_name}') : 'Questions owners ask', items: ang === 'fresh' ? FD(C.STORM_FAQ) : ang === 'recent' ? FD(C.STORM_LATE_FAQ) : FD(C.AC.replace.faq).slice(0, 4) }); authors();
        band(ang === 'fresh' ? F('Get your roof checked for damage from {st_name}.') : ang === 'recent' ? 'Get your roof checked for storm damage.' : 'Get an itemized roof replacement estimate.', BAND_T); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'landing': {
        page.breadcrumbs = []; page.summary = es ? F(`Página de campaña: {city}.`) : F(`Campaign landing page: ${LAB(p.line)}, {cityFull}.`);
        if (es) {
          const com = COM_LINES.includes(p.line);
          hero({ eyebrow: F(A.es.h[1] || A.es.h[0]), lede: F(A.es.d[0]), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: C.ES.aq, body: C.ES.answer[ES_ANS[p.line] || 'general'] });
          sec.push({ type: 'key_facts', heading: '', items: [{ value: C.ES.facts.permitV, label: C.ES.facts.permit, source: C.ES.facts.permitSrc }, { value: V.officeCity, label: C.ES.facts.office, source: brand }, { value: V.lic, label: C.ES.facts.lic, source: brand }] });
          sec.push({ type: 'features', heading: 'Por qué llamarnos', items: FD(C.ES.features) });
          sec.push({ type: 'faq', heading: 'Antes de llamar', items: FD(C.ES.faq.filter(f => !com || f.id === 'lic').map(f => ({ q: f.q, a: f.a }))) });
          formSec(C.ES.formHead, F(A.es.d[1] || A.es.d[0])); band(F(C.ES.band.heading), C.ES.band.text);
        } else {
          hero({ eyebrow: F(A.eyebrow), lede: F(A.lp), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: A.aq, body: F(A.answer) });
          sec.push({ type: 'key_facts', heading: '', items: facts(A.lfacts) });
          sec.push({ type: 'features', heading: 'Before you call', items: [{ title: F('LSLBC license {lic}'), text: 'Check it on the board\'s website before you sign anything.' }, { title: F('Office in {officeCity}'), text: F('{officeLine}') }, { title: 'The rule that matters', text: A.dl }] });
          sec.push({ type: 'faq', heading: 'Questions people ask', items: FD(A.faq).slice(0, 3) });
          formSec(FORM_H, FORM_T); band(F(A.band + ' in {city}.'), BAND_T);
        }
        notice(); break; }
      case 'guide': {
        const g = C.GUIDES.find(x => x.id === p.topic);
        page.summary = firstSentence(strip(F(g.answer)));
        hero({ eyebrow: 'Guide · ' + (g.scope === 'city' ? V.city : 'Louisiana'), lede: F(g.meta), layout: 'center', media: undefined, trust: false, cta: ['primary'] });
        sec.push({ type: 'answer', heading: 'The short answer', body: F(g.answer) });
        sec.push({ type: 'key_facts', heading: 'The facts behind it', items: facts(g.facts) });
        if (g.table === 'citystorms') { const c = CITY[p.city]; const zs = new Set(c.zips || []); const rowsS = RT.map(r => [r, footStats(r.r, z => zs.has(z.zip))]).filter(([, f]) => f.vmax >= 50).sort((a, b) => b[0].year - a[0].year || b[1].vmax - a[1].vmax).slice(0, 8);
          if (rowsS.length) sec.push({ type: 'table', heading: F('Storms that brought winds of 58 mph or more to the {city} ZIP codes since ' + ST.ry0), columns: ['Storm', 'Year', 'Peak sustained wind, mph (model)', 'Roofs damaged (estimate)'], rows: rowsS.map(([r, f]) => [stormName(r), String(r.year), N(ktMph(f.vmax)), N(roundNice(f.est))]) }); }
        g.body.forEach((b, i) => sec.push({ type: 'rich_text', heading: F(g.heads[i] || ''), html: F(b) }));
        sec.push({ type: 'faq', heading: 'Questions readers ask', items: FD(g.faq) }); authors();
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
  const ctxOf = cfg => ({ lic: cfg.site.lic || '', offices: officeList(cfg.site), certs: cfg.site.certs || '', fortified: cfg.site.fortified || '', juris: 'Louisiana' });
  function checks(bp, r, cfg, p) {
    const I = []; const add = (id, sev, where, ev, msg, cite, fix) => { if (!I.some(x => x.id === id && x.where === where)) I.push({ id, sev, where, ev, msg, cite, fix }); };
    const txt = pageText(bp); const ctx = ctxOf(cfg);
    const PHR = /your company|\[license number\]|your city/i; let ph = 0;
    txt.forEach(([where, t]) => satchelLint(t, Object.assign({ web: true }, ctx)).forEach(l => { const id = l.rule.id;
      if (id === 'HOUSE2' && PHR.test(l.ev)) { ph++; return; }
      add(id, l.rule.sev, where, l.ev, l.rule.name, l.rule.cite, l.rule.fix); }));
    if (ph) { const miss = [!cfg.site.brand && 'company name', !cfg.site.lic && 'LSLBC license number', !cfg.site.city && 'office city'].filter(Boolean); add('COMPANY', 'block', 'page', `${ph} placeholder${ph === 1 ? '' : 's'}`, `Company details missing${miss.length ? ': ' + miss.join(', ') : ''}; the page prints a placeholder`, 'R.S. 37:2156.4; house style', 'Fill step 1 or the Company panel (top right).'); }
    const lines = (cfg.build.lines || LINES); const res = p && p.line ? RES_LINES.includes(p.line) : lines.some(k => RES_LINES.includes(k));
    const all = txt.map(x => x[1]).join('\n');
    satchelLint(all, Object.assign({ asset: true, page: true, res }, ctx)).filter(l => l.rule.id === 'LIC1' || l.rule.id === 'LIC2').forEach(l => add(l.rule.id, l.rule.sev, 'page', l.ev, l.rule.name, l.rule.cite, l.rule.fix));
    const src = r.html + '\n' + JSON.stringify(r.schema);
    SAT.web.forEach(w => { let ev = null; try { ev = w.test(src, ctx); } catch (e) { } if (ev) add(w.id, w.sev, 'page source', ev, w.name, w.cite, w.fix); });
    if (p && p.line === 'fortified' && !cfg.site.fortified) add('FORT0', 'warn', 'page', 'no FORTIFIED status set', 'FORTIFIED service page for a company with no FORTIFIED status on file', 'IBHS FORTIFIED program terms', 'Set the FORTIFIED status in step 1 if the company is FORTIFIED trained, or untick the FORTIFIED line.');
    if (p && p.line && COM_LINES.includes(p.line) && !/commercial|building construction|sheet metal/i.test(cfg.site.licClass || '')) add('LIC5', 'note', 'page', cfg.site.licClass ? 'classifications: ' + cfg.site.licClass : 'no classifications set', 'Commercial page: confirm the commercial license and roofing classification', 'La. R.S. 37:2150.1 and following ($50,000 commercial threshold)', 'Enter the license classifications in step 1.');
    (r.lint || []).forEach((s, li) => { const block = /^BLOCK/.test(s); const media = /^MEDIA/.test(s); const lk = /no internal links/.test(s);
      add('FORGE', block ? 'block' : (media || lk) ? 'note' : 'warn', 'compiler ' + (li + 1), '', lk ? 'No internal links yet: paste the live sitemap in step 4 and links are drawn from it' : media ? s.replace(/\s*;\s*resolved at deploy.*$/, '').replace(/ — .*$/, '').replace(/^MEDIA: /, 'Media ') + ', resolved at deploy' : s, '', ''); });
    if ((bp.page.h1 || '').length > 70) add('LEN', 'warn', 'seo.h1', bp.page.h1.length + ' chars', 'H1 over 70 characters', '', 'Shorten in the studio.');
    if ((bp.page.title || '').length > 60) add('LEN', 'warn', 'seo.title', bp.page.title.length + ' chars', 'Title over 60 characters', '', 'Shorten in the studio.');
    if (bp._missing.length) add('VARS', 'warn', 'template', bp._missing.join(', '), 'Template values without data on this page were dropped; read the page for gaps', '', 'Fill the field in step 1 or pick a place with the data.');
    const n = s => I.filter(x => x.sev === s).length;
    return { issues: I.sort((x, y) => ['block', 'warn', 'note'].indexOf(x.sev) - ['block', 'warn', 'note'].indexOf(y.sev)), block: n('block'), warn: n('warn'), note: n('note') };
  }
  const wordCount = bp => pageText(bp).filter(([w]) => !w.startsWith('seo.') && !w.startsWith('form.')).reduce((t, [, s]) => t + words(s), 0);
  return { KL, CITY, LINES, PH, METRICS, ST, defaultCfg, syncBrand, markets, stormOptions, stormLocal, chosenStorms, angleOf, plan, blueprint, checks, pageText, wordCount, parseLive, cityExtra, parishExtra, distMi, office, factItem, baseVars, varsFor, fill, anchorFrom, officeList };
})();

registerModule({
  key: 'forge', num: '09', title: 'Site Forge', desc: 'Service, city, parish, storm and guide pages written from the atlas, linted by the Compliance Satchel and compiled for WordPress',
  mount(root) {
    const E = FORGE, FC = FORGE_COMPILE;
    const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; };
    const saved = store.get('up.forge.v1', null);
    let CFG = merge(E.defaultCfg(), saved || {});
    if (CFG.site.followBrand !== false) E.syncBrand(CFG, false);
    let LIVE = E.parseLive(CFG.site.live, CFG.site.url);
    let PLAN = { pages: [], removed: [], markets: [], storms: [] }, BUILT = new Map(), SEL = null, ASSETS = [], DEPLOYED = new Map(), WPSTAT = null, TAB = 'preview', PUBLISH_OK = false;
    const save = debounce(() => { CFG.media.assets = ASSETS.map(a => ({ id: a.id, file: a.file, kind: a.kind, w: a.w, h: a.h })); store.set('up.forge.v1', CFG); }, 400);
    const SITE_F = [
      ['brand', 'Company name', 'text', 'As licensed with the LSLBC. Empty, pages read "Your company" and every page blocks.'], ['url', 'Public site URL', 'url', 'Canonicals, schema and the live sitemap host use this.'], ['cms', 'WordPress URL, if different (headless)', 'url'],
      ['phone', 'Phone', 'tel', 'A local number that rings the office; a call tracking number should forward to it.'], ['email', 'Lead email (form notifications)', 'email'],
      ['lic', 'LSLBC license number', 'text', 'Printed in the trust strip, the notice and the schema of every page. Residential roofing of $7,500 or more may be advertised only under the Residential Roofing or Residential Construction license (R.S. 37:2156.4). Empty, every page blocks.'],
      ['licClass', 'License classifications', 'text', 'For example: Residential Roofing; Commercial, Roofing and Sheet Metal. Commercial pages ask for a commercial classification.'],
      ['contact', 'Qualifying party or owner (optional)', 'text', 'Named on the About page and as the reviewer of the service pages and guides.'], ['contactRole', 'Their role, as printed', 'text'], ['contactBio', 'Two sentences about them (optional)', 'text'],
      ['street', 'Office street', 'text', 'Written without hyphens or dashes; it prints in every page footer.'], ['city', 'Office city', 'text', 'A real office customers can reach; Google, Local Services Ads and customers check it.'], ['zip', 'ZIP', 'text'], ['offices', 'Other office cities, comma separated', 'text'],
      ['hours', 'Hours, as customers read them', 'text', 'Only if actually staffed.'], ['hoursEs', 'Hours in Spanish', 'text'], ['hoursSchema', 'Hours for schema (openingHours)', 'text'],
      ['warranty', 'Workmanship warranty statement (optional)', 'text', 'Exact terms only; prints on the About page. "Lifetime" claims are flagged.'], ['financing', 'Financing statement (optional)', 'text', 'A payment, a number of payments, a down payment or a rate needs the full Regulation Z terms beside it, or the page blocks.'],
      ['certs', 'Manufacturer certifications (exact program names)', 'text', 'Only programs currently held; the Satchel blocks certification claims not listed here.'], ['fortified', 'FORTIFIED status', 'text', 'Leave blank unless FORTIFIED trained; the FORTIFIED service page warns without it.'],
      ['sameAs', 'Profiles for sameAs (Google, Facebook, Nextdoor), comma separated', 'text'], ['logo_url', 'Logo URL', 'url'], ['font_heading', 'Heading font', 'text'], ['font_body', 'Body font', 'text'],
      ['cta_label', 'Primary button label', 'text'], ['cta_url', 'Primary button URL', 'text'], ['form_shortcode', 'Form shortcode (plugin forms)', 'text'], ['video_url', 'Explainer video URL (YouTube or Vimeo)', 'url'], ['span', 'Spanish landing pages where Spanish at home is at least (%)', 'number'],
    ];
    const PLACE = { brand: 'Your company', lic: 'License number', city: 'Your city', street: '100 Main Street, Suite 200', cta_label: 'Book a roof inspection', contactRole: 'Qualifying party' };
    const kindOpts = Object.entries(E.KL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const parOpts = PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('');
    root.innerHTML = mastHTML({ eyebrow: 'Module 09 · Site Forge', title: 'Site Forge', dek: 'The atlas turned into the website its campaigns land on: a service page for each of the eleven roofing lines, a page for each market city, optional parish hubs, storm pages for the named storms that shaped the market\'s roofs, campaign landing pages in English and Spanish, and data and rules guides written from the roof stock, the storm record and the Louisiana law register. Every page prints the company name, the LSLBC license number and a real office, is linted by the Compliance Satchel, carries no hyphens or dashes, compiles in the browser to Elementor, semantic HTML and JSON-LD, and deploys to WordPress as drafts through the FORGE bridge.',
      meta: [`<b>${N(CITIES.length)}</b> cities with roof and storm facts`, `<b>${N(PA.length)}</b> parishes · <b>${N(RT.length)}</b> named storms`, `<b>${FCOPY.GUIDES.length}</b> guide topics · <b>${PL.length}</b> service lines`, '<b>Internal links</b> only to live URLs'],
      bar: 'Site Forge', barsub: 'Plan, build, deploy', actions: [['f9Pack', '↓ Pack'], ['f9ElZ', '↓ Elementor'], ['f9BpZ', '↓ Blueprints'], ['f9Bridge', '↓ Bridge plugin'], ['f9LedX', '↓ Ledger'], ['f9Save', '⤓ Save'], ['f9Load', '⤒ Load']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the forge does and does not do', `Modules one to eight say where the old roofs and the storm damage are, which ZIPs pay back, what the license, permit and claims rules are and what the ads say. This module writes the pages those ads land on. Describe the company once, choose the markets, tick the page types, and the forge plans the set, writes each page from the atlas's own numbers with a public source beside every figure, and checks it. It never publishes on its own, never writes a review, a rating or a job result, never says what insurance covers or offers anything toward a deductible, never links to a page that is not live on the site's sitemap, and never uses Ahrefs. Deploying from the hosted atlas is blocked by the viewer's network rules, so deploy from the downloaded standalone file or hand the pack to the FORGE skill.`)}
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

      <div class="card mt"><div class="card-h"><h3>2 · Where to focus</h3><p>Cities come from the atlas's ZIP model: roof age, the storm record and the eleven service line pools. Rank them by the work the company wants, and limit them to where its crews will drive.</p></div><div class="card-b">
        <div class="plan">
          <div class="f"><label class="fl" for="f9Scope">Scope</label><select id="f9Scope"><option value="radius">Within a drive of the office</option><option value="parish">Selected parishes</option><option value="all">All of Louisiana</option><option value="pick">Hand picked cities</option></select></div>
          <div class="f"><label class="fl" for="f9Miles">Miles from the office</label><input type="number" id="f9Miles" min="5" max="250" step="5"></div>
          <div class="f"><label class="fl" for="f9Pars">Parishes (parish scope)</label><select id="f9Pars" multiple size="4">${parOpts}</select></div>
          <div class="f"><label class="fl" for="f9Metric">Rank by</label><select id="f9Metric">${Object.entries(E.METRICS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
          <div class="f"><label class="fl" for="f9N">Cities · minimum residents</label><div style="display:flex;gap:6px"><input type="number" id="f9N" min="1" max="120" style="width:80px"><select id="f9Min"><option value="0">any</option><option value="5000">5,000+</option><option value="10000">10,000+</option><option value="25000">25,000+</option><option value="50000">50,000+</option></select></div></div>
          <div class="f wide"><label class="fl" for="f9Picks">Hand picked cities (comma separated; other modules send their ZIPs here as cities)</label><input type="text" id="f9Picks" placeholder="Baton Rouge, Denham Springs, Gonzales"></div>
        </div>
        <div class="split"><div class="mapcard" style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><div id="f9Map"></div><div class="legend" id="f9Leg"></div></div><div><div class="tscroll short" id="f9Mk"></div><p class="mini" style="margin-top:8px">Click a city to drop it from the plan; click a ZIP on the map to add or drop its city. Hail reports and FEMA registrations are observed records placed by coordinates and ZIP (grade A); roof ages and the job pools are the atlas's models (grades B to D). "Residents" and every count sum the city's ZIP codes, which reach past city limits.</p></div></div>
      </div></div>

      <div class="card mt"><div class="card-h"><h3>3 · What to build</h3><p>Tick the page types and the lines. Storm pages default to two named storms that did the most modeled roof damage in the plan's cities: the worst recent storm, whose damage may still be on the roofs, and the worst storm of 13 to 24 years ago, whose replacement roofs are coming due. Pick others below.</p></div><div class="card-b">
        <div class="chips" id="f9Types">${[['home', 'Home page'], ['about', 'About and license page'], ['practice', 'Service page per line'], ['parishes', 'Parish hub per parish in the plan'], ['cities', 'City page per market city'], ['stormPages', 'Storm page per named storm'], ['landing', 'Campaign landing page per line and city'], ['es', 'Spanish landing variants (only if someone at the company speaks Spanish with customers)'], ['guides', 'Data and rules guides']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-b="${k}"> ${l}</label>`).join('')}</div>
        <div class="dsec" style="margin-top:14px">Service pages</div><div class="chips" id="f9Lines"></div>
        <div class="dsec" style="margin-top:14px">Landing page lines</div><div class="chips" id="f9Land"></div>
        <div class="dsec" style="margin-top:14px">Storms <span class="mini" id="f9RtNote"></span></div><div class="chips" id="f9Routes"></div>
        <div class="dsec" style="margin-top:14px">Guide topics</div><div class="chips" id="f9Topics"></div>
        <div class="mt">${callout('judg', 'Doorway risk: fewer, better city pages', 'Templated city pages are the fastest route into a doorway or scaled content problem. Every city page here carries that city\'s own roof stock, storm footprints, hail reports and FEMA record, but a dozen pages from one template still read as a pattern. If the site already has a page per suburb, consolidate or rewrite those before adding new ones, and publish a city page only where its numbers say something the others do not. The defaults are deliberately conservative: eight cities plus the office city, parish hubs off, landing pages noindexed, and the per city storm guide off.')}</div>
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

      <div class="card mt"><div class="card-h"><h3>7 · Media</h3><p>Drop photos and video of the company's own crews, finished roofs, trucks and office. Images are resized to 1920 pixels and converted to WebP in the browser. Assign each to the pages it belongs to; a page asset beats a city asset, which beats a parish asset, a page type asset and the site default. Unassigned slots resolve from the site's media library at deploy, and a page never ships with a placeholder.</p></div><div class="card-b">
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
    function firmWarn() { const s = S(); const miss = [!s.brand && 'company name', !s.lic && 'LSLBC license number', !s.city && 'office city'].filter(Boolean);
      $('#f9FirmWarn', root).innerHTML = miss.length ? callout('', `Pages preview with ${miss.map(m => m === 'company name' ? '"Your company"' : m === 'LSLBC license number' ? '"[license number]"' : '"Your city"').join(', ')} and every page blocks`, `Set the ${listAndUI(miss)} in step 1 or in the Company panel (top right). The forge does not invent a company, a license or an office: advertising residential roofing of $7,500 or more requires the LSLBC Residential Roofing or Residential Construction license (R.S. 37:2156.4), and Google, Local Services Ads and customers check the office.`) : ''; }
    const listAndUI = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    $$('input[data-k], select[data-k], textarea[data-k]', root).forEach(i => i.addEventListener('change', () => { readSite(); firmWarn(); save(); replan(); }));
    $('#f9Brand', root).onclick = () => { E.syncBrand(CFG, true); writeSite(); save(); replan(); toast(brandSet() ? 'Company fields taken from the Company panel' : 'The Company panel is empty: fill it (top right) or type the company here'); };
    $('#f9Desk', root).onclick = () => { if (MODI.desk && !MODI.desk.mounted) { MODI.desk.mounted = true; try { MODI.desk.mount($('#mod-desk')); } catch (e) { console.error(e); } } const d = MODI.desk && MODI.desk.plan ? MODI.desk.plan() : store.get('up.desk.v1', null); if (!d) { toast('Open the Campaign Desk once so its plan exists'); return; }
      if (d.spanTh != null) S().span = d.spanTh;
      const zips = d.zips || (d.scope === 'picks' ? d.picks : null); if (zips && zips.length) { const names = citiesFromZips(zips).slice(0, 24); if (names.length) { CFG.focus.scope = 'pick'; CFG.focus.picks = names; } }
      const lines = d.line === 'blend' ? (d.lines || []) : [d.line]; const ok = lines.filter(k => FCOPY.AC[k]); if (ok.length) { CFG.build.landingLines = ok.slice(0, 3); ok.forEach(k => { if (!CFG.build.lines.includes(k)) CFG.build.lines.push(k); }); }
      if (d.storm && RTI[d.storm]) { CFG.build.stormPages = true; CFG.build.stormsAuto = false; CFG.build.storms = [...new Set([d.storm].concat(E.chosenStorms(CFG, PLAN.markets)))].slice(0, 6); }
      writeSite(); syncFocus(); syncBuild(); save(); replan(); $('#f9BuildNote', root).textContent = `Imported from the Campaign Desk: ${CFG.focus.scope === 'pick' ? CFG.focus.picks.length + ' cities' : 'scope kept'}, ${CFG.build.landingLines.length} landing line${CFG.build.landingLines.length === 1 ? '' : 's'}${d.storm && RTI[d.storm] ? ', a ' + d.storm + ' storm page' : ''}.`; };
    function citiesFromZips(zips) { const out = []; zips.forEach(z => { const c = CITIES.find(c => (c.zips || []).includes(z)) || (ZI[z] && E.CITY[ZI[z].city]); if (c && !out.includes(c.name)) out.push(c.name); }); return out; }

    /* ---------- focus ---------- */
    const map = new ZipMap($('#f9Map', root), { segHit: 'none', roads: false, aria: 'Map of the cities in the Site Forge plan', onSelect: zip => { const nm = citiesFromZips([zip])[0]; if (!nm) return; const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.picks = PLAN.markets.map(c => c.name); } if (F0.picks.includes(nm)) F0.picks = F0.picks.filter(x => x !== nm); else F0.picks.push(nm); syncFocus(); save(); replan(); },
      onHover: (zip, e) => { const z = ZI[zip]; if (!z) return; const nm = citiesFromZips([zip])[0]; const c = nm ? E.CITY[nm] : null; if (!c) { showTip(`<div class="tt">${esc(zip)}${z.city ? ' · ' + esc(z.city) : ''}</div><div class="ts">Not a city in the model</div>`, e); return; } const x = E.cityExtra(c); showTip(`<div class="tt">${esc(zip)} · ${esc(c.name)}</div>${tipRow('Roofs 20 years or older, city ZIPs (model)', N(x.ra20))}${tipRow('Hail reports 1 inch or larger, ' + E.ST.py0 + ' to ' + E.ST.py1, N(x.h1))}${tipRow('FEMA roof and wind registrations', N(x.fema))}${tipRow('Gross profit pool a year (model)', MM(c.fees))}${tipRow('Miles from office', D(E.distMi(c, CFG), 0))}<div class="tf">Click to add or drop this city</div>`, e); } });
    function syncFocus() { const f = CFG.focus; $('#f9Scope', root).value = f.scope; $('#f9Miles', root).value = f.miles; $('#f9Metric', root).value = f.metric; $('#f9N', root).value = f.n; $('#f9Min', root).value = String(f.minPop); $('#f9Picks', root).value = f.picks.join(', '); $$('#f9Pars option', root).forEach(o => o.selected = (f.parishes || []).includes(o.value)); }
    function readFocus() { const f = CFG.focus; f.scope = $('#f9Scope', root).value; f.miles = +$('#f9Miles', root).value || 45; f.metric = $('#f9Metric', root).value; f.n = clamp(+$('#f9N', root).value || 8, 1, 120); f.minPop = +$('#f9Min', root).value; f.parishes = $$('#f9Pars option', root).filter(o => o.selected).map(o => o.value); f.picks = $('#f9Picks', root).value.split(',').map(s => s.trim()).filter(s => E.CITY[s]); }
    ['#f9Scope', '#f9Miles', '#f9Metric', '#f9N', '#f9Min', '#f9Pars', '#f9Picks'].forEach(s => $(s, root).addEventListener('change', () => { readFocus(); if (CFG.focus.scope === 'pick' && !CFG.focus.picks.length) CFG.focus.picks = PLAN.markets.map(c => c.name); syncFocus(); save(); replan(); }));
    function renderFocus() {
      const ms = PLAN.markets; const mk = (E.METRICS[CFG.focus.metric] || E.METRICS.fees);
      const zset = new Set(); ms.forEach(c => (c.zips || []).forEach(z => zset.add(z)));
      const vals = ms.map(c => mk[1](c)); const q = qScale(vals, 'green', 1); const cityOf = {}; ms.forEach(c => (c.zips || []).forEach(z => { if (!cityOf[z]) cityOf[z] = c; }));
      map.fill(zip => cityOf[zip] ? q.f(mk[1](cityOf[zip])) : null); map.dim(zset.size ? zset : null);
      const o = E.office(CFG); map.pins(o.set ? [{ id: 'office', lat: o.lat, lon: o.lon, r: 9, fill: cssv('--bench'), shape: 'diamond', title: 'Office' }] : []);
      const fk = [CFG.focus.scope, CFG.focus.miles, (CFG.focus.parishes || []).join(','), CFG.focus.n, CFG.focus.minPop, CFG.focus.metric, CFG.focus.scope === 'pick' ? '' : 'x'].join('|'); if (fk !== map._fk) { map._fk = fk; if (zset.size && CFG.focus.scope !== 'all') map.fitTo([...zset]); else map.reset(); }
      const fmtV = v => /pool a year/.test(mk[0]) ? MM(v) : !isN(v) ? '—' : v < 10 && Math.round(v) !== v ? D(v, 1) : N(v);
      $('#f9Leg', root).innerHTML = legendHTML({ title: mk[0] + ', cities in the plan', R: q.R, lo: isN(q.lo) ? fmtV(q.lo) : '', hi: isN(q.hi) ? fmtV(q.hi) : '', note: o.set ? '◆ office' : 'No office set: the plan is statewide' });
      const dh = $('#f9Mk', root); dh._st = dh._st || { k: 'v', dir: -1 };
      dataTable(dh, [{ k: 'name', h: 'City', l: 1 }, { k: 'par', h: 'Parish', l: 1, v: c => PA[c.pi] ? PA[c.pi].name : '' }].concat(o.set ? [{ k: 'mi', h: 'Miles', v: c => E.distMi(c, CFG), f: v => D(v, 0) }] : []).concat([{ k: 'v', h: mk[0].replace(/ \(model\)$/, ''), v: c => mk[1](c), f: v => fmtV(v) }, { k: 'r20', h: 'Roofs 20+ (model)', v: c => E.cityExtra(c).ra20, f: v => N(v) }, { k: 'h1', h: 'Hail reports', v: c => E.cityExtra(c).h1, f: v => N(v) }, { k: 'fema', h: 'FEMA roof registrations', v: c => E.cityExtra(c).fema, f: v => N(v) }, { k: 'pop', h: 'Residents (ZIPs)', f: v => K(v) }, { k: 'span', h: 'Spanish at home', v: c => E.cityExtra(c).span_sh, f: v => P(v, 0) }]), ms,
        { id: c => c.name, onClick: nm => { const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.picks = ms.map(c => c.name); } F0.picks = F0.picks.filter(x => x !== nm); syncFocus(); save(); replan(); } });
      if (!ms.length) dh.innerHTML = '<p class="mini">No city passes these filters. Widen the drive, lower the population floor or switch scope.</p>';
    }

    /* ---------- build choices ---------- */
    function chipRow(host, ids, sel, label, onToggle) { host.innerHTML = ids.map(id => `<button type="button" class="chip" data-id="${esc(id)}" aria-pressed="${sel.includes(id)}">${esc(label(id))}</button>`).join(''); $$('button', host).forEach(b => b.onclick = () => { onToggle(b.dataset.id); }); }
    const tog = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : arr.concat([id]);
    function syncBuild() { const B = CFG.build; $$('#f9Types [data-b]', root).forEach(i => i.checked = !!B[i.dataset.b]);
      chipRow($('#f9Lines', root), E.LINES, B.lines, id => PLI[id].short, id => { B.lines = tog(B.lines, id); syncBuild(); save(); replan(); });
      chipRow($('#f9Land', root), E.LINES, B.landingLines, id => PLI[id].short, id => { B.landingLines = tog(B.landingLines, id); syncBuild(); save(); replan(); });
      const opts = E.stormOptions(PLAN.markets); const chosen = E.chosenStorms(CFG, PLAN.markets); const ids = [...new Set(opts.map(r => r.r).concat(chosen))];
      chipRow($('#f9Routes', root), ids, chosen, id => id + ' · ' + K(E.stormLocal(id, PLAN.markets).est) + ' roofs', id => { B.storms = tog(chosen, id); B.stormsAuto = false; syncBuild(); save(); replan(); });
      $('#f9RtNote', root).innerHTML = (PLAN.markets.length ? ' · roofs damaged in the plan\'s cities (model)' : ' · roofs damaged statewide (model)') + (B.stormsAuto ? '; automatic: the worst recent storm and the worst storm of 13 to 24 years ago' : '; <a href="#" id="f9RtAuto">back to automatic</a>');
      const ra = $('#f9RtAuto', root); if (ra) ra.onclick = e => { e.preventDefault(); B.stormsAuto = true; B.storms = []; syncBuild(); save(); replan(); };
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
        { l: 'Pages planned', v: N(P0.length), d: `${by('practice')} service · ${by('city')} city · ${by('storm')} storm · ${by('landing')} landing · ${by('guide')} guides${by('parish') ? ' · ' + by('parish') + ' parish' : ''}` },
        { l: 'Cities in the plan', v: N(ms.length), d: ms.slice(0, 4).map(c => c.name).join(', ') + (ms.length > 4 ? ' and ' + (ms.length - 4) + ' more' : '') },
        { l: 'Roofs 20 years or older in their ZIPs', g: 'B', v: K(sum(fx.map(x => x.ra20))), d: `${P(100 * sum(fx.map(x => x.ra20)) / META.ra20, 0)} of the state's modeled total · ${K(sum(fx.map(x => x.wave)))} more within five years` },
        { l: 'Gross profit pool a year', g: 'D', v: MM(sum(ms.map(c => c.fees))), d: `${P(100 * sum(ms.map(c => c.fees)) / META.fees_tot, 0)} of the statewide pool, in the plan's cities` },
        { l: 'Built', v: `${N(bs.length)} of ${N(P0.length)}`, d: bs.length ? `${N(sum(bs.map(b => b.words)))} words` : 'press Build all pages' },
        { l: 'Blocking checks', v: N(sum(bs.map(b => b.ch.block))), d: `${N(sum(bs.map(b => b.ch.warn)))} warnings · ${N(sum(bs.map(b => b.ch.note)))} notes` },
        { l: 'Internal links', v: N(sum(bs.map(b => b.bp.page.internal_links.length))), d: LIVE.items.length ? `from ${N(LIVE.items.length)} live URLs` : 'none until live URLs are pasted' }]); }
    function renderLedger() {
      const t = $('#f9LType', root).value, q = $('#f9LSearch', root).value.trim().toLowerCase(), showRem = $('#f9LRem', root).checked;
      const rows = PLAN.pages.concat(showRem ? PLAN.removed.map(p => Object.assign({ _rem: true }, p)) : []).filter(p => (!t || p.kind === t) && (!q || (p.label + ' ' + p.slug + ' ' + (p.city || '') + ' ' + (p.line || '') + ' ' + (p.storm || '')).toLowerCase().includes(q)));
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
    function assignOptions(cur) { const cities = PLAN.markets.map(c => c.name); const fips = [...new Set(PLAN.markets.map(c => PA[c.pi] ? PA[c.pi].fips : '').filter(Boolean))];
      const opts = [['', 'Unassigned'], ['default', 'Site default hero'], ['author', 'Qualifying party headshot']].concat(Object.keys(E.KL).map(k => ['kind:' + k, 'All ' + E.KL[k].toLowerCase() + ' pages'])).concat(fips.map(f => ['parish:' + f, PNAME(f) + ' Parish pages'])).concat(cities.map(c => ['city:' + c, c + ' pages']));
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
      files.push({ name: 'pack/README.md', data: `# Site Forge pack\n\n${PLAN.pages.length} pages for ${S().brand || E.PH.brand}, built ${ymd()} by the Uplift Louisiana Roofing Atlas, module 09.\n\nFolders: blueprints (source of truth), bundles (what the bridge imports, media unresolved), elementor (templates for Templates, Saved Templates, Import), html (semantic fallback), preview (open in a browser), schema (JSON-LD), assets (WebP images and video), media (per page media maps to fill). forge-bridge.php is the WordPress plugin.\n\nInternal links point only at URLs that were live on the pasted sitemap. Re-run links-check before publishing. Pages with a blocking check in ledger.csv must be fixed in the studio first.\n\n\`\`\`\n${cliText()}\n\`\`\`\n` });
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
      const V = E.baseVars(CFG, PLAN.markets); const keys = ['s_ra20', 's_wave', 's_nxt', 's_storms', 's_fema', 's_h1', 's_h175', 'hail_season', 's_mh', 'mh_cost', 's_steel_fact', 's_permits_fact', 's_out', 'life_fact', 'life_metal', 'life_comm', 'life_coat', 'permit_fact', 'lic7500', 'liab_fact', 'comm_fact', 'clock_fact', 'ded_fact', 'gouge_fact', 'grant_fact', 'nhwa_fact'];
      const rows = keys.map(k => E.factItem(k, V)).filter(Boolean).map(f => [esc(f.value), esc(f.label), esc(f.source), G(f.grade)]);
      rows.push(['per city', 'one unit roofs, roofs 20 years or older and reaching 20 within five years, hail reports, FEMA roof and wind registrations, and the storms that reached its ZIP codes', 'Census ACS 2020 to 2024; the atlas roof age model; NOAA Storm Events; OpenFEMA; NHC best tracks modeled to ZIP codes', G('A/B')],
        ['per parish', 'the same figures summed over the parish\'s ZIP codes', 'the same sources', G('A/B')],
        ['per storm', 'peak modeled sustained wind, homes in hurricane force winds and roofs damaged in the plan\'s cities; FEMA registrations statewide', 'NHC HURDAT2 wind radii; a damage curve fitted to FEMA registrations; OpenFEMA', G('B/C')]);
      $('#f9Method', root).innerHTML = `<div class="grid2"><div>${judgList([
        ['Pages', 'Each page is a FORGE blueprint: one JSON document naming the archetype, the RoofingContractor entity with the LSLBC license as its identifier, the call to action and form, the media slots and an ordered list of sections. The same blueprint compiles to Elementor flex containers, semantic HTML and JSON-LD here and in the FORGE skill\'s Python compiler.'],
        ['Copy', 'Service copy is written per line, the same eleven lines the Campaign Desk advertises, around the work, the signs owners see and the Louisiana rules that apply, with every statement of law carrying its citation. City, parish and storm pages are written from that place\'s own roof stock, storm footprints, hail reports and FEMA record; guides from the roof age model, the storm record and the law register.'],
        ['Standard', 'Title of 60 characters or fewer, meta of 120 to 158, one H1 of 70 or fewer, an answer capsule under the hero, sourced key facts, a FAQ of real questions, a primary call to action with the phone, a sticky mobile bar, a consent form with an unchecked box, and a notice on every page with the company name, the LSLBC license number and the office.'],
        ['Links', 'Internal links come only from the live URLs pasted in step 4, scored by how well the path matches the page\'s service line and city. Pages in the plan link to each other only after they are live. Breadcrumbs name Home only when the home page is on the live list.'],
        ['Checks', 'Every text field runs the Compliance Satchel rule pack (LSLBC licensing and permits, the claims, deductible and assignment statutes, FORTIFIED and certification claims, financing disclosures, FTC review and "free" rules) and the house style; the page source runs the web rules (license number and office on the page, no prechecked consent, no self served ratings, no claim or deductible offers). A block stops deploy here and in module 16.']])}</div>
        <div><div class="xscroll"><table class="prose"><thead><tr><th>Value</th><th>Fact as printed</th><th>Source printed on the page</th><th>Grade</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>
        ${callout('judg', 'Judgment calls to check before publishing', judgList([
          ['No company is assumed', 'The forge opens brand neutral. Until the company name, the LSLBC license number and an office city are set, pages read "Your company", "[license number]" and "Your city" and every page blocks. Nothing is filled from a competitor or a sample company.'],
          ['The license goes on every page', 'Since August 1, 2026 advertising residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction license (R.S. 37:2156.4), so the license number prints in the trust strip, the notice and the schema. Commercial pages also need the commercial license and roofing classification for jobs of $50,000 or more; enter the classifications in step 1.'],
          ['No claims, coverage or deductible language', 'Pages say what a roofer does: inspect, document with photos, write an itemized estimate and do the work. They never say what a policy covers, never offer claim help and never offer anything toward a deductible (R.S. 37:2159.1, R.S. 51:451). A roofer may show damage to an adjuster at the owner\'s request, and the copy says so in those words.'],
          ['Modeled numbers say so', 'Roof ages, roofs reaching 20 and roofs damaged by a storm are the atlas\'s estimates and print with "by our estimate" and the method as the source. Storm winds are modeled sustained winds at ZIP codes from NHC best tracks, not measured gusts. FEMA counts only people who applied for federal help, and the pages say the count understates the damage.'],
          ['No reviews, ratings or results by default', 'The forge writes no review, rating, review count or job result. Customer statements you paste print with a note that they describe one job, and the schema carries no aggregateRating (16 CFR Part 465).'],
          ['FORTIFIED and certifications', 'The FORTIFIED service line and guide are on by default only when the Company panel holds a FORTIFIED status, and manufacturer certifications print only as entered. Grants are described as drawn by lottery, up to $10,000, and insurance discounts as filed by each insurer, never as a promised amount.'],
          ['Storm pages have two angles', 'A storm of the last six years gets a "damage that is still there" page with the insurer\'s clock; a storm of 13 to 24 years ago gets a page about the roofs replaced after it coming due. Pages about older storms talk about roofs, not claims.'],
          ['Click every statute link once', 'Law statements link to legis.la.gov, the LSLBC and eCFR pages read on October 5 and 6, 2026. Open each link in a browser before publishing. A few statements (price gouging, home improvement fraud, private works liens, the residential code) cite the provision without a page link; confirm those citations too.'],
          ['Counts are by ZIP code, not city limits', 'City figures sum the city\'s ZIP codes, which reach past city limits, and the pages say "in the Lafayette ZIP codes".'],
          ['Photos are the company\'s own', 'Use photos of the company\'s crews, finished roofs, trucks and office. Stock photos of storm damage can mislead when they read as the company\'s own jobs.'],
          ['Spanish pages need a Spanish speaker', 'Spanish landing pages say "Hablamos español". Tick them only if someone at the company speaks Spanish with customers.'],
          ['Conservative page count', 'Eight cities plus the office city, two storms, parish hubs off and the per city storm guide off. Templated location pages are the pattern search engines treat as doorways; add places only where the numbers differ.'],
          ['Landing pages are noindex', 'Campaign landing pages duplicate the city and service pages\' intent; they stay out of the index unless you untick the option.'],
          ['Slugs keep hyphens', 'URL slugs use hyphens as separators, which is how WordPress builds them; no hyphen appears in visible copy.']]))}
        ${callout('note', 'Hand off to the FORGE skill', `Download the pack, unzip it beside the FORGE toolkit and run the commands in its README, or paste them into a Claude session that has the forge skill: it resolves media, checks every internal link against the live sitemap, imports each page as a draft through the bridge and reports the links. The pack's plan.json reloads here with ⤒ Load.<pre style="margin-top:8px">${esc(cliText())}</pre>`)}
        <div class="dsec" style="margin-top:14px">Sources</div>${srcRows([
          ['Licensing and permits', 'LSLBC memorandum on the 2025 and 2026 statutory changes (Acts 2025, Nos. 239 and 422; Acts 2026, No. 757) and the LSLBC licensing requirements brochure', 'A', 'read Oct 6, 2026', 'https://lslbc.gov/'],
          ['Louisiana law', 'Revised Statutes on legis.la.gov: R.S. 37:2159.1, 51:451 and 51:452, 22:1892, 22:1483.1, 29:732, 9:4801, 9:3141 (citations on each page)', 'A', 'read Oct 5 and 6, 2026', 'https://legis.la.gov/'],
          ['Federal rules', 'FTC Cooling Off Rule (16 CFR Part 429), consumer reviews rule (16 CFR Part 465) and Regulation Z advertising (12 CFR 1026.24), on eCFR', 'A', '', 'https://www.ecfr.gov/'],
          ['Roof stock', 'Census ACS 2020 to 2024 (B25034, B25024, B25127); American Housing Survey 2023; the atlas roof age model (module 17)', 'A/B', '2024', 'https://www.census.gov/programs-surveys/acs'],
          ['Storms', 'NOAA NHC HURDAT2 best tracks and wind radii; NOAA Storm Events Database 2016 to 2026; SPC severe reports 1996 to 2025', 'A/B', '2026', 'https://www.nhc.noaa.gov/data/'],
          ['FEMA', 'OpenFEMA Individuals and Households Program registrations, Louisiana disasters 2004 to 2026', 'A', '2026', 'https://www.fema.gov/about/openfema/data-sets'],
          ['Prices and permits', 'BLS Producer Price Index (WPU1017, WPU1361) via FRED; Census Building Permits Survey', 'A', 'Aug 2026', 'https://fred.stlouisfed.org/series/WPU1017'],
          ['FORTIFIED', 'IBHS FORTIFIED Roof standard; Louisiana Fortify Homes Program (LDI)', 'A', '2026', 'https://fortifiedhome.org/'],
          ['Schema', 'schema.org RoofingContractor', 'A', '', 'https://schema.org/RoofingContractor']])}`;
    }

    /* ---------- hooks ---------- */
    this.receive = p => { if (!p) return; let names = []; if (p.zips && p.zips.length) names = citiesFromZips(p.zips); if (p.cities && p.cities.length) names = p.cities.filter(n => E.CITY[n]);
      const notes = [];
      if (names.length) { CFG.focus.scope = 'pick'; CFG.focus.picks = names.slice(0, 24); notes.push(`${Math.min(24, names.length)} cities`); }
      if (p.line && FCOPY.AC[p.line]) { if (!CFG.build.lines.includes(p.line)) CFG.build.lines.push(p.line); CFG.build.landingLines = [p.line]; notes.push(lineName(p.line).replace(/\b[A-Z][a-z]+\b/g, w => w.toLowerCase()) + ' landing pages'); }
      if (p.storm && RTI[p.storm]) { CFG.build.stormPages = true; const cur = E.chosenStorms(CFG, E.markets(CFG)); CFG.build.stormsAuto = false; CFG.build.storms = [...new Set([p.storm].concat(cur))].slice(0, 6); notes.push(p.storm + ' storm page'); }
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