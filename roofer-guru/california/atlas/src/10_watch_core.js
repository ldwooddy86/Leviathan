/* ==== 10_watch_core.js ==== */
/* ==== src/10_watch_core.js ==== */
/* ==== watch_core ==== */
"use strict";
/* ============================ COMPETITOR WATCH: roster, licence field, ledger, library links, API bridge, importers, analytics ============================ */
/* California has no public ranked roster of roofers: the data carries only the few companies named in the evidence. The watchlist
   therefore starts short and the analyst adds the companies met in the market (kept in this browser with the ledger); the size of the
   field comes from Contractors State License Board C-39 licence counts by city and county and from Census establishment counts. */
/* The ledger lives in this browser (localStorage) and travels as JSON or CSV. Nothing here calls a platform on its own: the Meta Ad
   Library API bridge builds the request and runs it only when the page is opened outside the Claude viewer (whose network rules block
   it) and a token is supplied; otherwise the request URL opens in a new tab and the JSON answer is pasted back into the importer. */
const WATCH = (() => {
  const KEY = 'cg.watch.v1'; const ROSTER_DATE = META.compiled || '2026-11-19';
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const domOf = u => { const m = String(u || '').toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/); return m ? m[1] : ''; };
  /* ---------- companies ---------- */
  const TIERS = ['statewide', 'national', 'regional', 'local'];
  const mk = (c, i, custom) => ({ key: slug(c.name), i, name: c.name, domain: domOf(c.domain || c.url), url: c.url || '', tier: TIERS.includes(c.tier) ? c.tier : 'local', hq: c.hq || '', cities: (c.cities || []).slice(), offices: c.offices || [], lines: (c.lines || []).filter(k => LINE_KEYS.includes(k)), verified: !!c.verified, spanish: !!c.spanish, langs: c.langs || (c.spanish ? ['es'] : []), title: c.title || '', desc: c.desc || '', h1: c.h1 || '', social: c.social || [], notes: c.notes || '', asof: c.asof || '', seg: c.seg || '', lic_no: c.lic_no || '', src: c.src || '', custom: !!custom });
  /* the roster in the data, then the companies the analyst added (COMPANIES and CI are live: they are refilled in place) */
  const ROSTER = COMP.filter(c => c && c.name).map((c, i) => mk(c, i, false));
  const COMPANIES = ROSTER.slice(); const CI = {}; COMPANIES.forEach(c => CI[c.key] = c);
  function rebuild() { COMPANIES.length = 0; Object.keys(CI).forEach(k => delete CI[k]); ROSTER.forEach(c => { COMPANIES.push(c); CI[c.key] = c; }); ((S && S.custom) || []).forEach(c => { if (!c || !c.name) return; const o = mk(c, -1, true); if (!CI[o.key]) { COMPANIES.push(o); CI[o.key] = o; } }); }
  const isBench = c => !!(BRAND.domain && c.domain && domOf(BRAND.domain) === c.domain);
  /* ---------- taxonomies ---------- */
  const KINDS = { ad: 'Ad', claim: 'Claim (offer, warranty, reviews)', signal: 'Signal', event: 'Event', reviews: 'Review snapshot' };
  const PLATFORMS = { meta: 'Meta (Facebook, Instagram)', google: 'Google Search', lsa: 'Local Services Ads', youtube: 'YouTube', microsoft: 'Microsoft Advertising', tiktok: 'TikTok', nextdoor: 'Nextdoor', site: 'Website', tv: 'Television or streaming', radio: 'Radio or podcast', ooh: 'Billboard or bus', mail: 'Direct mail', signs: 'Yard signs, wraps or door hangers', door: 'Door to door canvassing', other: 'Other' };
  const FORMATS = ['image', 'video', 'carousel', 'text', 'lead form', 'story or reel', 'display', 'billboard', 'sign or hanger', 'other'];
  const OFFERS = { free: 'Free inspection or estimate', insurance: 'Insurance, claim or deductible talk', financing: 'Financing or payments', warranty: 'Warranty or lifetime claim', reviews: 'Review counts or ratings', certs: 'Certification or manufacturer claim', fire: 'Fire resistance, Class A or home hardening claim', energy: 'Cool roof, energy or rebate claim', license: 'Licence, bond or insured claim', speed: 'Speed or availability', spanish: 'Spanish or other language service', none: 'No claim' };
  const HOOKS = ['free inspection', 'insurance and deductible', 'financing', 'warranty', 'reviews and trust', 'certifications', 'fire hardening and Class A', 'wildfire rebuild', 'cool roof and energy', 'solar', 'tile', 'local roots', 'rain and leak response', 'wind response', 'metal', 'Spanish', 'speed', 'other'];
  const LINE_IDS = LINE_KEYS.slice();
  /* ---------- inference ---------- */
  /* the thirteen California lines, most specific first */
  const inferLine = t => { t = String(t || '').toLowerCase();
    if (/class a\b|ember|fire[- ]?(hardened|hardening|resistant|safe|rated|wise)|home hardening|wildfire[- ]prepared|defensible/.test(t)) return 'harden';
    if (/fire damage|wildfire|smoke damage|rebuild|burn(ed)? down/.test(t)) return 'fire';
    if (/solar|photovoltaic|\bpv\b|detach|remove and reinstall/.test(t)) return 'solar';
    if (/lift and relay|relay|underlayment|\btile\b|clay|concrete tile|spanish tile/.test(t)) return 'tile';
    if (/mobile home|manufactured home|roof ?over/.test(t)) return 'mh';
    if (/apartment|condo|\bhoa\b|multifamily|multi family|homeowners association/.test(t)) return 'mf';
    if (/coating|restoration|silicone|maintenance|elastomeric/.test(t)) return 'coat';
    if (/commercial|flat roof|\btpo\b|\bpvc\b|epdm|low slope|warehouse|industrial|cool roof|title 24/.test(t)) return 'comm';
    if (/new construction|builders?\b|new homes?/.test(t)) return 'newc';
    if (/metal|standing seam/.test(t)) return 'metal';
    if (/storm|wind|santa ana|atmospheric river|tarp|emergency/.test(t)) return 'storm';
    if (/leak|repair/.test(t)) return 'repair';
    if (/replace|new roof|re-?roof|shingle|roofing|roofer/.test(t)) return 'replace';
    return ''; };
  const RX_INS = /deductible|insurance (pays|covers|approved|claim)|claims? (help|specialist|expert|handling)|free roof|no out of pocket|we (handle|work with|deal with|negotiate with) (your |the )?insur/;
  const RX_FIRE = /class a\b|ember|fire[- ]?(proof|hardened|hardening|resistant|safe|rated)|home hardening|wildfire[- ]prepared|wildfire/;
  const inferOffer = t => { t = String(t || '').toLowerCase(); if (RX_INS.test(t)) return 'insurance'; if (/free (roof )?(inspection|estimate|quote|assessment)/.test(t)) return 'free'; if (/financ|\$\s?\d+\s?(\/|a |per )\s?mo|no money down|0%|monthly payments?/.test(t)) return 'financing'; if (/warrant|lifetime|guarantee/.test(t)) return 'warranty'; if (RX_FIRE.test(t)) return 'fire'; if (/cool roof|title 24|energy|rebate|tax credit/.test(t)) return 'energy'; if (/review|★|star|rated/.test(t)) return 'reviews'; if (/\bgaf\b|owens corning|certainteed|malarkey|master elite|platinum|certified/.test(t)) return 'certs'; if (/licen[sc]ed|bonded|insured|cslb|c-?39|lic\.? ?#/.test(t)) return 'license'; if (/24\/7|24 7|same day|fast|available now|call now|emergency/.test(t)) return 'speed'; if (/español|spanish|hablamos|中文|tiếng việt|tagalog|한국어/.test(t)) return 'spanish'; return 'none'; };
  const inferHook = t => { t = String(t || '').toLowerCase(); if (RX_INS.test(t)) return 'insurance and deductible'; if (/free (roof )?(inspection|estimate|quote)/.test(t)) return 'free inspection'; if (/financ|no money down|monthly payments?/.test(t)) return 'financing'; if (/warrant|lifetime|guarantee/.test(t)) return 'warranty'; if (/fire damage|rebuild|burn(ed)? down/.test(t)) return 'wildfire rebuild'; if (RX_FIRE.test(t)) return 'fire hardening and Class A'; if (/cool roof|title 24|energy|rebate/.test(t)) return 'cool roof and energy'; if (/solar|photovoltaic/.test(t)) return 'solar'; if (/\btile\b|underlayment|lift and relay/.test(t)) return 'tile'; if (/review|★|star|rated|trust/.test(t)) return 'reviews and trust'; if (/\bgaf\b|owens corning|certainteed|malarkey|master elite|platinum|certified/.test(t)) return 'certifications'; if (/family owned|local|hometown|born|raised|since 19|since 20/.test(t)) return 'local roots'; if (/leak|rain|atmospheric river|tarp/.test(t)) return 'rain and leak response'; if (/storm|wind|santa ana/.test(t)) return 'wind response'; if (/metal|standing seam/.test(t)) return 'metal'; if (/español|spanish|hablamos/.test(t)) return 'Spanish'; if (/24\/7|same day|fast|now/.test(t)) return 'speed'; return 'other'; };
  /* ---------- state ---------- */
  let S;
  function blank() { return { obs: [], meta: {}, custom: [], settings: { keepToken: false, token: '', apiVersion: 'v21.0' }, seeded: false, created: today() }; }
  function load() { const s = store.get(KEY, null); if (s && Array.isArray(s.obs)) { s.meta = s.meta || {}; s.custom = Array.isArray(s.custom) ? s.custom : []; s.settings = Object.assign({ keepToken: false, token: '', apiVersion: 'v21.0' }, s.settings || {}); return s; } const b = blank(); b.obs = seed(); b.seeded = true; return b; }
  function save() { try { const s = JSON.parse(JSON.stringify(S)); if (!s.settings.keepToken) s.settings.token = ''; store.set(KEY, s); } catch (e) { } BUS.emit('watch'); }
  /* ---------- seed observations from the site reads the data carries (only companies whose own site was read) ---------- */
  function seed() {
    const out = [];
    COMPANIES.forEach(c => {
      if (isBench(c) || !c.verified) return; const base = { comp: c.key, compName: c.name, src: 'seed', first: c.asof || ROSTER_DATE, last: c.asof || ROSTER_DATE, status: 'unknown', lang: 'en', geo: c.hq, zips: [], platform: 'site', format: 'text', url: c.url };
      const txt = [c.title, c.desc].filter(Boolean).join(' · ');
      if (txt) out.push(Object.assign({}, base, { id: uid(), kind: 'claim', line: inferLine(txt), text: 'Site title and description: ' + txt, hook: inferHook(txt), offer: { type: inferOffer(txt), text: txt } }));
      if (c.spanish) out.push(Object.assign({}, base, { id: uid(), kind: 'signal', line: '', text: 'Spanish pages on the site', hook: 'Spanish', offer: { type: 'spanish', text: '' }, lang: 'es' }));
      if (c.notes && /calls itself|slogan|moniker|big truck/i.test(c.notes)) out.push(Object.assign({}, base, { id: uid(), kind: 'claim', line: inferLine(c.notes), text: c.notes, hook: inferHook(c.notes), offer: { type: inferOffer(c.notes), text: '' } }));
    });
    return out.map(o => { o.lint = lintObs(o); return o; });
  }
  /* ---------- library deep links ---------- */
  const enc = encodeURIComponent;
  const LINKS = {
    metaKw: q => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${enc(q)}&search_type=keyword_unordered&media_type=all`,
    metaKwAll: q => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${enc(q)}&search_type=keyword_unordered&media_type=all`,
    metaPage: id => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=${enc(id)}&search_type=page&media_type=all`,
    metaLib: id => `https://www.facebook.com/ads/library/?id=${enc(id)}`,
    googleDomain: d => `https://adstransparency.google.com/?region=US&domain=${enc(domOf(d))}`,
    googleAdv: id => `https://adstransparency.google.com/advertiser/${enc(id)}?region=US`,
    googleCreative: (adv, cr) => `https://adstransparency.google.com/advertiser/${enc(adv)}/creative/${enc(cr)}?region=US`,
    gSearch: (name, city) => `https://www.google.com/search?q=${enc(name + ' ' + (city || 'California') + ' roofing')}`,
    gMaps: (name, city) => `https://www.google.com/maps/search/?api=1&query=${enc(name + ' ' + (city || 'California'))}`,
    /* the licence board's public data portal (lists by classification and county; the licence master file) */
    cslbPortal: () => 'https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList.aspx',
    site: d => d ? (/^https?:/.test(d) ? d : 'https://' + d) : '',
  };
  /* ---------- Meta Ad Library API bridge ---------- */
  const API_FIELDS = { base: ['id', 'page_id', 'page_name', 'ad_creation_time', 'ad_delivery_start_time', 'ad_delivery_stop_time', 'ad_creative_bodies', 'ad_creative_link_titles', 'ad_creative_link_descriptions', 'ad_creative_link_captions', 'ad_snapshot_url', 'publisher_platforms', 'languages'], political: ['bylines', 'currency', 'spend', 'impressions', 'demographic_distribution', 'delivery_by_region', 'estimated_audience_size'], eu: ['target_locations', 'target_ages', 'target_gender', 'eu_total_reach', 'beneficiary_payers'] };
  function metaApiUrl(o) {
    o = o || {}; const v = o.version || S.settings.apiVersion || 'v21.0'; const p = new URLSearchParams();
    if (o.token) p.set('access_token', o.token);
    p.set('ad_reached_countries', JSON.stringify(o.countries && o.countries.length ? o.countries : ['US']));
    p.set('ad_type', o.adType || 'ALL'); p.set('ad_active_status', o.status || 'ACTIVE');
    if (o.terms) p.set('search_terms', o.terms); if (o.pageIds && o.pageIds.length) p.set('search_page_ids', JSON.stringify(o.pageIds));
    if (o.terms) p.set('search_type', o.searchType || 'KEYWORD_UNORDERED');
    if (o.since) p.set('ad_delivery_date_min', o.since);
    const f = API_FIELDS.base.concat(o.adType === 'POLITICAL_AND_ISSUE_ADS' ? API_FIELDS.political : []).concat(o.eu ? API_FIELDS.eu : []); p.set('fields', f.join(',')); p.set('limit', String(o.limit || 100));
    return `https://graph.facebook.com/${v}/ads_archive?${p.toString()}`;
  }
  const canFetch = () => !inViewer();
  async function metaApiRun(o) {
    const url = metaApiUrl(o); const out = []; let next = url, pages = 0;
    while (next && pages < (o.maxPages || 5)) { const r = await fetch(next, { mode: 'cors' }); const j = await r.json(); if (j.error) throw new Error(j.error.message || 'Graph API error'); (j.data || []).forEach(x => out.push(x)); next = j.paging && j.paging.next; pages++; }
    return out;
  }
  /* ---------- matching and importers ---------- */
  const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(inc|llc|llp|pllc|plc|co|company|corp|roofing|roofers?|roof|construction|contracting|contractors?|restoration|exteriors?|services|group|the|of|and|california|calif|ca|socal|norcal)\b/g, ' ').replace(/\s+/g, ' ').trim();
  function matchCompany(name, domainOrUrl) {
    const d = domOf(domainOrUrl); if (d) { const hit = COMPANIES.find(c => c.domain && (c.domain === d || d.endsWith('.' + c.domain))); if (hit) return hit; }
    const n = norm(name); if (!n) return null; const exact = COMPANIES.find(c => norm(c.name) === n); if (exact) return exact;
    const toks = n.split(' ').filter(t => t.length > 2); let best = null, bs = 0; COMPANIES.forEach(c => { const cn = norm(c.name); const hits = toks.filter(t => cn.includes(t)).length; const sc = hits / Math.max(1, toks.length); if (sc > bs && hits >= 1 && sc >= 0.5) { bs = sc; best = c; } });
    return best;
  }
  function fromMetaApi(items) {
    return (items || []).map(x => { const caption = (x.ad_creative_link_captions || [])[0] || ''; const c = matchCompany(x.page_name, caption); const body = (x.ad_creative_bodies || [])[0] || ''; const title = (x.ad_creative_link_titles || [])[0] || ''; const text = [title, body].filter(Boolean).join(' · ');
      return blankObs({ comp: c ? c.key : '', compName: c ? c.name : (x.page_name || 'Unmatched page'), kind: 'ad', platform: 'meta', status: x.ad_delivery_stop_time ? 'inactive' : 'active', first: (x.ad_delivery_start_time || x.ad_creation_time || '').slice(0, 10), last: (x.ad_delivery_stop_time || today()).slice(0, 10), format: 'other', line: inferLine(text), text, hook: inferHook(text), url: caption, lang: (x.languages || [])[0] === 'es' ? 'es' : 'en', ids: { lib: x.id || '', page: x.page_id || '', adv: '', cr: '' }, snapshot: x.ad_snapshot_url || '', notes: (x.publisher_platforms || []).join(', '), src: 'meta-api', offer: { type: inferOffer(text), text: '' } }); });
  }
  function fromUrls(text, compKey) {
    const out = []; const meta = {}; String(text || '').split(/\s+/).forEach(u => { let m; if ((m = u.match(/ads\/library\/\?id=(\d+)/))) out.push(blankObs({ comp: compKey, platform: 'meta', kind: 'ad', ids: { lib: m[1] }, snapshot: LINKS.metaLib(m[1]), src: 'import' })); else if ((m = u.match(/view_all_page_id=(\d+)/))) meta.pageId = m[1]; else if ((m = u.match(/adstransparency\.google\.com\/advertiser\/(AR\d+)\/creative\/(CR\d+)/))) out.push(blankObs({ comp: compKey, platform: 'google', kind: 'ad', ids: { adv: m[1], cr: m[2] }, snapshot: u, src: 'import' })); else if ((m = u.match(/adstransparency\.google\.com\/advertiser\/(AR\d+)/))) meta.advId = m[1]; });
    return { obs: out, meta };
  }
  const CSV_H = ['id', 'competitor', 'competitor_key', 'kind', 'platform', 'status', 'first_seen', 'last_seen', 'format', 'service_line', 'claim_type', 'claim_text', 'hook', 'cta', 'landing_url', 'geo', 'zips', 'language', 'meta_library_id', 'meta_page_id', 'google_advertiser_id', 'google_creative_id', 'snapshot_url', 'text', 'notes', 'source', 'review_count', 'review_rating', 'lint'];
  function toRow(o) { return [o.id, o.compName, o.comp, o.kind, o.platform, o.status, o.first, o.last, o.format, o.line, o.offer && o.offer.type, o.offer && o.offer.text, o.hook, o.cta, o.url, o.geo, (o.zips || []).join(' '), o.lang, o.ids && o.ids.lib, o.ids && o.ids.page, o.ids && o.ids.adv, o.ids && o.ids.cr, o.snapshot, o.text, o.notes, o.src, o.reviews && o.reviews.count, o.reviews && o.reviews.rating, (o.lint || []).join(' ')]; }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false; const s = String(text || '').replace(/\r/g, '');
    for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.length > 1 && !String(r[0]).startsWith('#'));
  }
  function fromCSV(text) {
    const rows = parseCSV(text); if (!rows.length) return []; const H = rows[0].map(h => String(h).trim().toLowerCase()); const ix = k => H.indexOf(k); const g = (r, k) => { const i = ix(k); return i >= 0 ? String(r[i] || '').trim() : ''; };
    return rows.slice(1).map(r => { const c = CI[g(r, 'competitor_key')] || matchCompany(g(r, 'competitor'), g(r, 'landing_url')); return blankObs({ comp: c ? c.key : '', compName: c ? c.name : g(r, 'competitor'), kind: KINDS[g(r, 'kind')] ? g(r, 'kind') : 'ad', platform: PLATFORMS[g(r, 'platform')] ? g(r, 'platform') : 'other', status: g(r, 'status') || 'unknown', first: g(r, 'first_seen'), last: g(r, 'last_seen'), format: g(r, 'format') || 'other', line: LINE_IDS.includes(g(r, 'service_line')) ? g(r, 'service_line') : LINE_IDS.includes(g(r, 'practice_line')) ? g(r, 'practice_line') : inferLine(g(r, 'text') + ' ' + g(r, 'claim_text')), offer: { type: OFFERS[g(r, 'claim_type')] ? g(r, 'claim_type') : inferOffer(g(r, 'claim_text') + ' ' + g(r, 'text')), text: g(r, 'claim_text') }, hook: HOOKS.includes(g(r, 'hook')) ? g(r, 'hook') : inferHook(g(r, 'text')), cta: g(r, 'cta'), url: g(r, 'landing_url'), geo: g(r, 'geo'), zips: g(r, 'zips').split(/\s+/).filter(Boolean), lang: g(r, 'language') || 'en', ids: { lib: g(r, 'meta_library_id'), page: g(r, 'meta_page_id'), adv: g(r, 'google_advertiser_id'), cr: g(r, 'google_creative_id') }, snapshot: g(r, 'snapshot_url'), text: g(r, 'text'), notes: g(r, 'notes'), src: g(r, 'source') === 'seed' ? 'seed' : 'import', reviews: g(r, 'review_count') ? { count: +g(r, 'review_count'), rating: +g(r, 'review_rating') || null } : null }); });
  }
  function blankObs(o) { const c = o && o.comp ? CI[o.comp] : null; return Object.assign({ id: uid(), comp: c ? c.key : '', compName: c ? c.name : '', kind: 'ad', platform: 'meta', status: 'active', first: today(), last: today(), format: 'image', line: '', offer: { type: 'none', text: '' }, hook: 'other', cta: '', url: '', geo: '', zips: [], lang: 'en', ids: { lib: '', page: '', adv: '', cr: '' }, snapshot: '', text: '', notes: '', src: 'manual', reviews: null, lint: [] }, o || {}); }
  function importText(text, compKey) {
    const t = String(text || '').trim(); if (!t) return { obs: [], meta: {}, note: 'Nothing to import' };
    if (t[0] === '{' || t[0] === '[') { let j; try { j = JSON.parse(t); } catch (e) { return { obs: [], meta: {}, note: 'That is not valid JSON' }; } if (j && j.obs && Array.isArray(j.obs)) return { obs: j.obs.map(o => blankObs(Object.assign({}, o, { src: o.src === 'seed' ? 'seed' : 'import' }))), meta: j.meta || {}, note: `${j.obs.length} ledger entries from an atlas export` }; const items = Array.isArray(j) ? j : (j.data || []); return { obs: fromMetaApi(items), meta: {}, note: `${items.length} ads from a Meta Ad Library API response` }; }
    if (/adstransparency\.google\.com|facebook\.com\/ads\/library/.test(t)) { const r = fromUrls(t, compKey); return { obs: r.obs, meta: r.meta, note: `${r.obs.length} ad links${r.meta.pageId ? ', a Meta Page ID' : ''}${r.meta.advId ? ', a Google advertiser ID' : ''}` }; }
    if (/,/.test(t.split('\n')[0])) { const o = fromCSV(t); return { obs: o, meta: {}, note: `${o.length} rows from CSV` }; }
    return { obs: [], meta: {}, note: 'Paste a Meta Ad Library API JSON response, ad library links, or a ledger CSV' };
  }
  /* ---------- lint (Satchel rules on the copy; house style off for competitors) ---------- */
  function lintObs(o) { const txt = [o.text, o.offer && o.offer.text, o.cta].filter(Boolean).join(' '); if (!txt || typeof satchelLint !== 'function') return []; return [...new Set(satchelLint(txt, { platform: o.platform, web: o.platform === 'site', page: o.platform === 'site', noHouse: true }).filter(x => x.rule.sev !== 'note').map(x => x.rule.id))]; }
  /* ---------- CRUD ---------- */
  function add(o) { const ob = blankObs(o); ob.lint = lintObs(ob); S.obs.push(ob); save(); return ob; }
  function update(id, patch) { const o = S.obs.find(x => x.id === id); if (!o) return; Object.assign(o, patch); if (o.comp && CI[o.comp]) o.compName = CI[o.comp].name; o.lint = lintObs(o); save(); }
  function remove(id) { S.obs = S.obs.filter(x => x.id !== id); save(); }
  function addMany(list, metaPatchKey, meta) { list.forEach(o => { const ob = blankObs(o); ob.lint = lintObs(ob); S.obs.push(ob); }); if (metaPatchKey && meta && (meta.pageId || meta.advId)) setMeta(metaPatchKey, { pageId: meta.pageId, advId: meta.advId }); save(); }
  function setMeta(key, patch) { S.meta[key] = Object.assign(S.meta[key] || {}, patch); Object.keys(S.meta[key]).forEach(k => { if (S.meta[key][k] == null || S.meta[key][k] === '') delete S.meta[key][k]; }); save(); }
  function meta(key) { return S.meta[key] || {}; }
  function clearSeeds() { S.obs = S.obs.filter(o => o.src !== 'seed'); S.seeded = false; save(); }
  function reseed() { S.obs = S.obs.filter(o => o.src !== 'seed').concat(seed()); S.seeded = true; save(); }
  function replaceAll(obj) { if (obj && Array.isArray(obj.obs)) { S = Object.assign(blank(), obj); S.custom = Array.isArray(S.custom) ? S.custom : []; rebuild(); S.obs = S.obs.map(o => blankObs(o)); save(); } }
  /* ---------- the analyst's own additions to the watchlist ---------- */
  function addCompany(o) { const name = String((o && o.name) || '').trim(); if (!name) return null; const key = slug(name); if (CI[key]) return CI[key]; const c = { name, domain: domOf(o.domain || o.url), url: o.url || (o.domain ? 'https://' + domOf(o.domain) : ''), hq: String(o.hq || '').trim(), tier: TIERS.includes(o.tier) ? o.tier : 'local', lines: (o.lines || []).filter(k => LINE_KEYS.includes(k)), cities: o.hq ? [String(o.hq).trim()] : [], offices: [], verified: false, spanish: !!o.spanish, lic_no: String(o.lic_no || '').replace(/[^0-9]/g, ''), notes: String(o.notes || ''), asof: today(), src: 'added by the analyst' }; S.custom.push(c); rebuild(); save(); return CI[key]; }
  function updateCompany(key, patch) { const c = CI[key]; if (!c || !c.custom) return; const raw = S.custom.find(x => slug(x.name) === key); if (!raw) return; Object.assign(raw, patch || {}); if (patch && patch.lines) raw.lines = patch.lines.filter(k => LINE_KEYS.includes(k)); rebuild(); save(); }
  function removeCompany(key) { const c = CI[key]; if (!c || !c.custom) return; S.custom = S.custom.filter(x => slug(x.name) !== key); S.obs = S.obs.filter(o => o.comp !== key); delete S.meta[key]; rebuild(); save(); }
  function setSettings(p) { Object.assign(S.settings, p); save(); }
  /* ---------- analytics ---------- */
  const daysAgo = d => { const t = Date.parse(d); return isN(t) ? (Date.now() - t) / 864e5 : 9e9; };
  const isLive = o => o.status === 'active' || (o.status === 'unknown' && o.kind === 'ad' && daysAgo(o.last) <= 60);
  function activity() { const out = {}; S.obs.forEach(o => { if (o.src === 'seed' || o.kind !== 'ad' || !o.comp || !isLive(o) || daysAgo(o.last) > 120) return; const a = out[o.comp] = out[o.comp] || { _all: 0 }; a._all++; if (o.line) a[o.line] = (a[o.line] || 0) + 1; }); return out; }
  function forCompany(key) { return S.obs.filter(o => o.comp === key).sort((a, b) => String(b.last).localeCompare(String(a.last))); }
  const TW = { statewide: 30, national: 24, regional: 14, local: 6 };
  function score(c) { const obs = forCompany(c.key); const live = obs.filter(o => o.kind === 'ad' && isLive(o)); const plats = new Set(live.map(o => o.platform)); return (TW[c.tier] || 0) + Math.min(40, live.length * 6) + plats.size * 5 + (c.spanish ? 6 : 0) + Math.min(10, (c.offices || []).length) + (obs.some(o => o.offer && o.offer.type === 'insurance') ? 4 : 0); }
  function stats() {
    const obs = S.obs; const ads = obs.filter(o => o.kind === 'ad'); const live = ads.filter(isLive); const byComp = {}; live.forEach(o => byComp[o.comp || o.compName] = (byComp[o.comp || o.compName] || 0) + 1);
    const byPlat = {}; live.forEach(o => byPlat[o.platform] = (byPlat[o.platform] || 0) + 1);
    const claims = obs.filter(o => o.offer && o.offer.type && o.offer.type !== 'none'); const byOffer = {}; claims.forEach(o => byOffer[o.offer.type] = (byOffer[o.offer.type] || 0) + 1);
    const byHook = {}; obs.forEach(o => { if (o.hook) byHook[o.hook] = (byHook[o.hook] || 0) + 1; });
    const byLine = {}; obs.forEach(o => { if (o.line) byLine[o.line] = (byLine[o.line] || 0) + 1; });
    const byLint = {}; obs.forEach(o => (o.lint || []).forEach(id => byLint[id] = (byLint[id] || 0) + 1));
    const companies = new Set(obs.filter(o => o.comp).map(o => o.comp)); const lastObs = obs.filter(o => o.src !== 'seed').map(o => o.last).sort().pop() || null;
    const checked = Object.values(S.meta).map(m => m.lastChecked).filter(Boolean).sort(); const lastSweep = checked.pop() || null;
    return { n: obs.length, ads: ads.length, live: live.length, byComp, byPlat, byOffer, byHook, byLine, byLint, companies: companies.size, lastObs, lastSweep, seeded: obs.filter(o => o.src === 'seed').length, lints: obs.filter(o => (o.lint || []).length).length };
  }
  function weekly(weeks) { weeks = weeks || 26; const now = Date.now(); const out = Array.from({ length: weeks }, (_, i) => ({ w: i, t: now - (weeks - 1 - i) * 7 * 864e5, meta: 0, google: 0, other: 0 })); S.obs.forEach(o => { if (o.kind !== 'ad') return; const t = Date.parse(o.first || o.last); if (!isN(t)) return; const i = Math.floor((t - out[0].t) / (7 * 864e5)); if (i < 0 || i >= weeks) return; const k = o.platform === 'meta' ? 'meta' : (o.platform === 'google' || o.platform === 'lsa' || o.platform === 'youtube') ? 'google' : 'other'; out[i][k]++; }); return out; }
  function zipCounts() { const m = {}; S.obs.forEach(o => { if (!isLive(o) && o.kind === 'ad') return; (o.zips || []).forEach(z => m[z] = (m[z] || 0) + 1); }); return m; }
  function digest() {
    const st = stats(); const out = []; const compsLive = Object.keys(st.byComp).length; const tracked = COMPANIES.filter(c => !isBench(c)).length; const ver = COMPANIES.filter(c => c.verified);
    if (st.live) out.push(`${N(compsLive)} of ${N(tracked)} tracked companies have ${N(st.live)} ads on record as live${st.byPlat.meta ? `, ${N(st.byPlat.meta)} on Meta` : ''}${st.byPlat.google ? `, ${N(st.byPlat.google)} on Google Search` : ''}${st.byPlat.lsa ? `, ${N(st.byPlat.lsa)} in Local Services` : ''}.`); else out.push(st.seeded ? `No competitor ad has been logged as live yet. The seeded entries are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; open the library links in the sweep planner and log what you see.` : `No competitor ad has been logged yet, and the atlas ships no site reads for California: the watchlist holds ${N(tracked)} companies. Add the companies you meet in your market, open their library links and log what you see.`);
    const ins = ver.filter(c => /insurance|claim|deductible/i.test(c.desc + ' ' + c.title)); if (ins.length) out.push(`${N(ins.length)} verified sites talk about insurance or claims in their title or description (${ins.slice(0, 4).map(c => c.name).join(', ')}${ins.length > 4 ? ' and others' : ''}). In California a contractor may not offer or advertise a discount meant to offset a deductible (Penal Code 551), and negotiating a claim for pay is public adjusting, which needs its own licence (Insurance Code 15006 and 15007), so read those pages closely (module 10).`);
    const fr = ver.filter(c => /\bfree\b/i.test(c.desc + ' ' + c.title)); if (fr.length) out.push(`${N(fr.length)} verified sites lead with something free, usually the inspection or estimate; "free" needs its conditions beside it (16 CFR Part 251).`);
    const sp = COMPANIES.filter(c => c.spanish); if (ver.length) out.push(`${N(sp.length)} of ${N(ver.length)} verified sites show Spanish pages${sp.length ? ' (' + sp.map(c => c.name).join(', ') + ')' : ''}.`);
    if (FIELD.state.lic) out.push(`The field is far larger than any watchlist: ${N(FIELD.state.lic)} active C-39 roofing licences across ${N(FIELD.cities.length)} mailing cities, most in ${FIELD.cities.slice(0, 3).map(c => `${c.city} (${N(c.lic)})`).join(', ')}. ${N(COMPANIES.filter(c => c.custom).length)} companies on the watchlist were added by you; ${N(ROSTER.length)} came with the atlas.`);
    const lineCnt = LINE_KEYS.map(k => [k, COMPANIES.filter(c => c.lines.includes(k)).length]).sort((a, b) => a[1] - b[1]); const lcn = k => SLM.lineName(k).replace(/\b[A-Z][a-z]+\b/g, w => w.toLowerCase()); if (COMPANIES.some(c => c.lines.length)) out.push(`Fewest companies market ${lineCnt.slice(0, 3).map(([k, n]) => `${lcn(k)} (${n})`).join(', ')}; most market ${lineCnt.slice(-2).map(([k, n]) => `${lcn(k)} (${n})`).join(' and ')}.`);
    const hooks = Object.entries(st.byHook).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 3); if (hooks.length) out.push(`The most common hooks on record: ${hooks.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
    if (st.lints) out.push(`${N(st.lints)} entries trip a Satchel rule (${Object.entries(st.byLint).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ')}). Each is intelligence first; a complaint only when the evidence is clear and a lawyer agrees (module 10).`);
    return out;
  }
  /* ---------- exports ---------- */
  function csv() { return toCSV(CSV_H, S.obs.map(toRow), `Competitor Watch ledger, California Roofer Guru, exported ${today()}. Seeded rows, if any, are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; the rest are observations logged by the analyst or imported from the Meta Ad Library API.`); }
  function json() { const s = JSON.parse(JSON.stringify(S)); s.settings.token = ''; return JSON.stringify(Object.assign({ exported: today(), atlas: 'California Roofer Guru, module 13' }, s), null, 1); }
  function sweepRows(scopeKeys) { return (scopeKeys || COMPANIES.filter(c => !isBench(c)).map(c => c.key)).map(k => { const c = CI[k], m = meta(k); return [c.name, c.domain, c.cities.join('; '), m.lastChecked || '', m.lastChecked ? Math.round(daysAgo(m.lastChecked)) : '', LINKS.metaKw(c.name.replace(/,? (LLC|LLP|PLC|Inc|Co)\.?$/i, '')), m.pageId ? LINKS.metaPage(m.pageId) : '', c.domain ? LINKS.googleDomain(c.domain) : '', m.advId ? LINKS.googleAdv(m.advId) : '', LINKS.gSearch(c.name, c.hq), forCompany(k).filter(o => o.kind === 'ad' && isLive(o)).length]; }); }
  /* ---------- the field by place: licences and establishments (the measure of competition when the roster is short) ---------- */
  const FIELD = (() => {
    const cnum = v => isN(v) ? +v : 0;
    const cities = (DATA.lic_city || []).map(a => { const p = CO[a[1]] || {}; return { city: a[0], pi: a[1], county: p.name || '', fips: p.fips || '', reg: p.reg, lic: cnum(a[2]), lic_all: cnum(a[3]) }; }).filter(c => c.city).sort((a, b) => b.lic - a.lic);
    const counties = CO.map(p => { const zs = Z.filter(z => z.pi === p.i); const roofs = isN(p.roofs) ? +p.roofs : sum(zs.map(z => z.roofs || 0)); const lic = isN(p.lic) ? +p.lic : sum(zs.map(z => z.lic || 0)); return { fips: p.fips, name: p.name, reg: p.reg, pop: cnum(p.pop), roofs, lic, lic_all: isN(p.lic_all) ? +p.lic_all : null, cbp: isN(p.cbp_roof) ? +p.cbp_roof : null, emp: isN(p.cbp_roof_emp) ? +p.cbp_roof_emp : null, roofers: isN(p.roofers) ? +p.roofers : sum(zs.map(z => z.roofers || 0)), nes: isN(p.nes2381) ? +p.nes2381 : null, fees: isN(p.fees) ? +p.fees : sum(zs.map(z => z.fees || 0)), per10k: p.pop ? lic / p.pop * 1e4 : null, roofsPer: lic ? roofs / lic : null, feesPer: lic ? (isN(p.fees) ? +p.fees : sum(zs.map(z => z.fees || 0))) / lic : null }; });
    const regions = REG_KEYS.map(k => { const cs = counties.filter(c => c.reg === k); const s = f => sum(cs.map(c => c[f] || 0)); const lic = s('lic'); return { k, name: REGN[k], n: cs.length, pop: s('pop'), roofs: s('roofs'), lic, cbp: s('cbp'), cbpGaps: cs.filter(c => c.cbp == null).length, roofers: s('roofers'), fees: s('fees'), per10k: s('pop') ? lic / s('pop') * 1e4 : null, roofsPer: lic ? s('roofs') / lic : null, feesPer: lic ? s('fees') / lic : null }; });
    const L = META.lic || {}; const state = { lic: isN(L.clear) ? +L.clear : sum(counties.map(c => c.lic)), roll: isN(L.n) ? +L.n : null, only: isN(L.only) ? +L.only : null, out: isN(L.out) ? +L.out : null, susp: isN(L.susp) ? +L.susp : null, cbp: (META.cbp || {}).est, emp: (META.cbp || {}).emp };
    return { cities, counties, regions, state };
  })();
  /* ---------- sample ads for the compliance bench. EVERY ONE IS INVENTED for this atlas: no company published them. ---------- */
  const SAMPLES = [
    { id: 's1', platform: 'meta', label: 'Deductible offer', text: 'Storm damage? We cover your deductible. New roof at no cost to you. Call today.' },
    { id: 's2', platform: 'google', label: 'Claim handling', text: 'Insurance claim specialists. We handle your claim from start to finish and negotiate with your insurer so you do not have to.' },
    { id: 's3', platform: 'meta', label: 'Free roof', text: 'Your insurance will pay for a free roof. Free inspection, no out of pocket cost, insurance approved contractor.' },
    { id: 's4', platform: 'site', label: 'Fire claims', text: 'Fireproof Class A roof guaranteed to save your home from wildfire. Keep your insurance: our roof stops non renewal.' },
    { id: 's5', platform: 'mail', label: 'After a fire', text: 'We are in your neighborhood rebuilding after the fire. Sign today and lock in a price before costs double. Cash discount, no permit needed.' },
    { id: 's6', platform: 'google', label: 'Financing terms', text: 'New roof from $99 a month, $0 down, 0% APR. Best roofer in California. Lifetime warranty.' },
    { id: 's7', platform: 'meta', label: 'No licence shown', text: 'Affordable roof repair and re-roofing. Licensed and insured. Text us for a same day quote.' },
    { id: 's8', platform: 'site', label: 'A careful ad', text: 'Roof inspections by request in Pasadena. Written estimate, permit pulled in your city, CSLB Lic. #0000000 (C-39). We do not negotiate insurance claims.' },
  ];
  /* screen any text with the California rule pack, house style off: [{id, sev, name, cite, ev, fix}] */
  function lintText(text, platform) { const txt = String(text || '').trim(); if (!txt || typeof satchelLint !== 'function') return []; let out = []; try { out = satchelLint(txt, { platform: platform || 'meta', web: platform === 'site', page: platform === 'site', channel: platform === 'door' ? 'door' : platform === 'mail' ? 'mail' : '', noHouse: true }); } catch (e) { out = []; } return out.filter(x => x && x.rule).map(x => ({ id: x.rule.id, sev: x.rule.sev, name: x.rule.name || x.rule.id, cite: x.rule.cite || '', ev: typeof x.ev === 'string' ? x.ev : '', fix: x.rule.fix || '' })); }
  S = load(); rebuild();
  return { COMPANIES, CI, ROSTER, TIERS, FIELD, SAMPLES, lintText, addCompany, updateCompany, removeCompany, KINDS, PLATFORMS, FORMATS, OFFERS, HOOKS, LINKS, API_FIELDS, ROSTER_DATE, isBench, get S() { return S; }, get obs() { return S.obs; }, settings: () => S.settings, setSettings, metaApiUrl, metaApiRun, canFetch, matchCompany, importText, blankObs, add, update, remove, addMany, setMeta, meta, clearSeeds, reseed, replaceAll, activity, forCompany, score, stats, weekly, zipCounts, digest, csv, json, sweepRows, isLive, daysAgo, inferLine, inferOffer, inferHook, lintObs, today, domOf };
})();