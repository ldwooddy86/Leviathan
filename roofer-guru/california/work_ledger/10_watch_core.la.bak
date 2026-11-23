/* ==== 10_watch_core.js ==== */
/* ==== src/10_watch_core.js ==== */
/* ==== watch_core ==== */
"use strict";
/* ============================ COMPETITOR WATCH: roster, ledger, library links, API bridge, importers, analytics ============================ */
/* The ledger lives in this browser (localStorage) and travels as JSON or CSV. Nothing here calls a platform on its own: the Meta Ad
   Library API bridge builds the request and runs it only when the page is opened outside the Claude viewer (whose network rules block
   it) and a token is supplied; otherwise the request URL opens in a new tab and the JSON answer is pasted back into the importer. */
const WATCH = (() => {
  const KEY = 'up.watch.v1'; const ROSTER_DATE = META.compiled || '2026-10-06';
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const domOf = u => { const m = String(u || '').toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/); return m ? m[1] : ''; };
  /* ---------- companies ---------- */
  const COMPANIES = COMP.map((c, i) => ({ key: slug(c.name), i, name: c.name, domain: domOf(c.domain || c.url), url: c.url, tier: c.tier, hq: c.hq, cities: (c.cities || []).slice(), offices: c.offices || [], lines: c.lines || [], verified: !!c.verified, spanish: !!c.spanish, title: c.title || '', desc: c.desc || '', h1: c.h1 || '', social: c.social || [], notes: c.notes || '', asof: c.asof || '' }));
  const CI = {}; COMPANIES.forEach(c => CI[c.key] = c);
  const isBench = c => !!(BRAND.domain && c.domain && domOf(BRAND.domain) === c.domain);
  /* ---------- taxonomies ---------- */
  const KINDS = { ad: 'Ad', claim: 'Claim (offer, warranty, reviews)', signal: 'Signal', event: 'Event', reviews: 'Review snapshot' };
  const PLATFORMS = { meta: 'Meta (Facebook, Instagram)', google: 'Google Search', lsa: 'Local Services Ads', youtube: 'YouTube', microsoft: 'Microsoft Advertising', tiktok: 'TikTok', nextdoor: 'Nextdoor', site: 'Website', tv: 'Television or streaming', radio: 'Radio or podcast', ooh: 'Billboard or bus', mail: 'Direct mail', signs: 'Yard signs, wraps or door hangers', door: 'Door to door canvassing', other: 'Other' };
  const FORMATS = ['image', 'video', 'carousel', 'text', 'lead form', 'story or reel', 'display', 'billboard', 'sign or hanger', 'other'];
  const OFFERS = { free: 'Free inspection or estimate', insurance: 'Insurance, claim or deductible talk', financing: 'Financing or payments', warranty: 'Warranty or lifetime claim', reviews: 'Review counts or ratings', certs: 'Certification or FORTIFIED claim', speed: 'Speed or availability', spanish: 'Spanish service', none: 'No claim' };
  const HOOKS = ['free inspection', 'insurance and deductible', 'financing', 'warranty', 'reviews and trust', 'certifications', 'FORTIFIED and grants', 'local roots', 'storm response', 'hail', 'metal', 'Spanish', 'speed', 'other'];
  const LINE_IDS = LINE_KEYS.slice();
  /* ---------- inference ---------- */
  const inferLine = t => { t = String(t || '').toLowerCase(); if (/fortified|fortify|ibhs/.test(t)) return 'fortified'; if (/hail/.test(t)) return 'hail'; if (/mobile home|manufactured home|roof ?over/.test(t)) return 'mh'; if (/apartment|condo|\bhoa\b|multifamily|multi family/.test(t)) return 'mf'; if (/coating|restoration|silicone|maintenance/.test(t)) return 'coat'; if (/commercial|flat roof|\btpo\b|\bpvc\b|epdm|low slope|warehouse|industrial/.test(t)) return 'comm'; if (/new construction|builders?\b/.test(t)) return 'newc'; if (/metal|standing seam/.test(t)) return 'metal'; if (/storm|hurricane|wind|tarp|emergency/.test(t)) return 'storm'; if (/leak|repair/.test(t)) return 'repair'; if (/replace|new roof|reroof|shingle|roofing|roofer/.test(t)) return 'replace'; return ''; };
  const RX_INS = /deductible|insurance (pays|covers|approved|claim)|claims? (help|specialist|expert)|free roof|no out of pocket|we (handle|work with) (your )?insurance/;
  const inferOffer = t => { t = String(t || '').toLowerCase(); if (RX_INS.test(t)) return 'insurance'; if (/free (roof )?(inspection|estimate|quote|assessment)/.test(t)) return 'free'; if (/financ|\$\s?\d+\s?(\/|a |per )\s?mo|no money down|0%|monthly payments?/.test(t)) return 'financing'; if (/warrant|lifetime|guarantee/.test(t)) return 'warranty'; if (/review|★|star|rated/.test(t)) return 'reviews'; if (/\bgaf\b|owens corning|certainteed|master elite|platinum|certified|fortified/.test(t)) return 'certs'; if (/24\/7|24 7|same day|fast|available now|call now|emergency/.test(t)) return 'speed'; if (/español|spanish|hablamos/.test(t)) return 'spanish'; return 'none'; };
  const inferHook = t => { t = String(t || '').toLowerCase(); if (RX_INS.test(t)) return 'insurance and deductible'; if (/free (roof )?(inspection|estimate|quote)/.test(t)) return 'free inspection'; if (/financ|no money down|monthly payments?/.test(t)) return 'financing'; if (/warrant|lifetime|guarantee/.test(t)) return 'warranty'; if (/review|★|star|rated|trust/.test(t)) return 'reviews and trust'; if (/fortified|fortify|grant/.test(t)) return 'FORTIFIED and grants'; if (/\bgaf\b|owens corning|certainteed|master elite|platinum|certified/.test(t)) return 'certifications'; if (/family owned|local|hometown|born|raised|since 19|since 20/.test(t)) return 'local roots'; if (/hail/.test(t)) return 'hail'; if (/storm|hurricane|wind|tarp/.test(t)) return 'storm response'; if (/metal|standing seam/.test(t)) return 'metal'; if (/español|spanish|hablamos/.test(t)) return 'Spanish'; if (/24\/7|same day|fast|now/.test(t)) return 'speed'; return 'other'; };
  /* ---------- state ---------- */
  let S;
  function blank() { return { obs: [], meta: {}, settings: { keepToken: false, token: '', apiVersion: 'v21.0' }, seeded: false, created: today() }; }
  function load() { const s = store.get(KEY, null); if (s && Array.isArray(s.obs)) { s.meta = s.meta || {}; s.settings = Object.assign({ keepToken: false, token: '', apiVersion: 'v21.0' }, s.settings || {}); return s; } const b = blank(); b.obs = seed(); b.seeded = true; return b; }
  function save() { try { const s = JSON.parse(JSON.stringify(S)); if (!s.settings.keepToken) s.settings.token = ''; store.set(KEY, s); } catch (e) { } BUS.emit('watch'); }
  /* ---------- seed observations from the verified site reads (October 5, 2026) ---------- */
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
    gSearch: (name, city) => `https://www.google.com/search?q=${enc(name + ' ' + (city || 'Louisiana') + ' roofing')}`,
    gMaps: (name, city) => `https://www.google.com/maps/search/?api=1&query=${enc(name + ' ' + (city || 'Louisiana'))}`,
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
  const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(inc|llc|llp|pllc|plc|co|company|corp|roofing|roofers?|roof|construction|contracting|contractors?|restoration|exteriors?|services|group|the|of|and|louisiana|la)\b/g, ' ').replace(/\s+/g, ' ').trim();
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
  function lintObs(o) { const txt = [o.text, o.offer && o.offer.text, o.cta].filter(Boolean).join(' '); if (!txt) return []; return [...new Set(satchelLint(txt, { platform: o.platform, web: o.platform === 'site', page: o.platform === 'site', noHouse: true }).filter(x => x.rule.sev !== 'note').map(x => x.rule.id))]; }
  /* ---------- CRUD ---------- */
  function add(o) { const ob = blankObs(o); ob.lint = lintObs(ob); S.obs.push(ob); save(); return ob; }
  function update(id, patch) { const o = S.obs.find(x => x.id === id); if (!o) return; Object.assign(o, patch); if (o.comp && CI[o.comp]) o.compName = CI[o.comp].name; o.lint = lintObs(o); save(); }
  function remove(id) { S.obs = S.obs.filter(x => x.id !== id); save(); }
  function addMany(list, metaPatchKey, meta) { list.forEach(o => { const ob = blankObs(o); ob.lint = lintObs(ob); S.obs.push(ob); }); if (metaPatchKey && meta && (meta.pageId || meta.advId)) setMeta(metaPatchKey, { pageId: meta.pageId, advId: meta.advId }); save(); }
  function setMeta(key, patch) { S.meta[key] = Object.assign(S.meta[key] || {}, patch); Object.keys(S.meta[key]).forEach(k => { if (S.meta[key][k] == null || S.meta[key][k] === '') delete S.meta[key][k]; }); save(); }
  function meta(key) { return S.meta[key] || {}; }
  function clearSeeds() { S.obs = S.obs.filter(o => o.src !== 'seed'); S.seeded = false; save(); }
  function reseed() { S.obs = S.obs.filter(o => o.src !== 'seed').concat(seed()); S.seeded = true; save(); }
  function replaceAll(obj) { if (obj && Array.isArray(obj.obs)) { S = Object.assign(blank(), obj); S.obs = S.obs.map(o => blankObs(o)); save(); } }
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
    if (st.live) out.push(`${N(compsLive)} of ${N(tracked)} tracked companies have ${N(st.live)} ads on record as live${st.byPlat.meta ? `, ${N(st.byPlat.meta)} on Meta` : ''}${st.byPlat.google ? `, ${N(st.byPlat.google)} on Google Search` : ''}${st.byPlat.lsa ? `, ${N(st.byPlat.lsa)} in Local Services` : ''}.`); else out.push(`No competitor ad has been logged as live yet. The seeded entries are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; open the library links in the sweep planner and log what you see.`);
    const ins = ver.filter(c => /insurance|claim|deductible/i.test(c.desc + ' ' + c.title)); if (ins.length) out.push(`${N(ins.length)} verified sites talk about insurance or claims in their title or description (${ins.slice(0, 4).map(c => c.name).join(', ')}${ins.length > 4 ? ' and others' : ''}). Louisiana bars contractors from advertising claim handling or policy interpretation and from offering anything toward a deductible, so read those pages closely (module 10).`);
    const fr = ver.filter(c => /\bfree\b/i.test(c.desc + ' ' + c.title)); if (fr.length) out.push(`${N(fr.length)} verified sites lead with something free, usually the inspection or estimate; "free" needs its conditions beside it (16 CFR Part 251).`);
    const sp = COMPANIES.filter(c => c.spanish); out.push(`${N(sp.length)} of ${N(ver.length)} verified sites show Spanish pages${sp.length ? ' (' + sp.map(c => c.name).join(', ') + ')' : ''}.`);
    const lineCnt = LINE_KEYS.map(k => [k, COMPANIES.filter(c => c.lines.includes(k)).length]).sort((a, b) => a[1] - b[1]); const lcn = k => SLM.lineName(k).replace(/\b[A-Z][a-z]+\b/g, w => w.toLowerCase()); out.push(`Fewest companies market ${lineCnt.slice(0, 3).map(([k, n]) => `${lcn(k)} (${n})`).join(', ')}; most market ${lineCnt.slice(-2).map(([k, n]) => `${lcn(k)} (${n})`).join(' and ')}.`);
    const hooks = Object.entries(st.byHook).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 3); if (hooks.length) out.push(`The most common hooks on record: ${hooks.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
    if (st.lints) out.push(`${N(st.lints)} entries trip a Satchel rule (${Object.entries(st.byLint).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ')}). Each is intelligence first; a complaint only when the evidence is clear and a lawyer agrees (module 10).`);
    return out;
  }
  /* ---------- exports ---------- */
  function csv() { return toCSV(CSV_H, S.obs.map(toRow), `Competitor Watch ledger, Uplift Louisiana Roofing Atlas, exported ${today()}. Seeded rows are the companies' own site titles and descriptions read on ${dateL(ROSTER_DATE)}; the rest are observations logged by the analyst or imported from the Meta Ad Library API.`); }
  function json() { const s = JSON.parse(JSON.stringify(S)); s.settings.token = ''; return JSON.stringify(Object.assign({ exported: today(), atlas: 'Uplift Louisiana Roofing Atlas, module 13' }, s), null, 1); }
  function sweepRows(scopeKeys) { return (scopeKeys || COMPANIES.filter(c => !isBench(c)).map(c => c.key)).map(k => { const c = CI[k], m = meta(k); return [c.name, c.domain, c.cities.join('; '), m.lastChecked || '', m.lastChecked ? Math.round(daysAgo(m.lastChecked)) : '', LINKS.metaKw(c.name.replace(/,? (LLC|LLP|PLC|Inc|Co)\.?$/i, '')), m.pageId ? LINKS.metaPage(m.pageId) : '', c.domain ? LINKS.googleDomain(c.domain) : '', m.advId ? LINKS.googleAdv(m.advId) : '', LINKS.gSearch(c.name, c.hq), forCompany(k).filter(o => o.kind === 'ad' && isLive(o)).length]; }); }
  S = load();
  return { COMPANIES, CI, KINDS, PLATFORMS, FORMATS, OFFERS, HOOKS, LINKS, API_FIELDS, ROSTER_DATE, isBench, get S() { return S; }, get obs() { return S.obs; }, settings: () => S.settings, setSettings, metaApiUrl, metaApiRun, canFetch, matchCompany, importText, blankObs, add, update, remove, addMany, setMeta, meta, clearSeeds, reseed, replaceAll, activity, forCompany, score, stats, weekly, zipCounts, digest, csv, json, sweepRows, isLive, daysAgo, inferLine, inferOffer, inferHook, lintObs, today, domOf };
})();