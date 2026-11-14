/* ==== src/dr/20_dr_tools.js ==== */
/* ==== dr_tools ==== */
"use strict";
/* ============================ Dr. HVAC: the tools the model calls ============================
   This is where the agent meets the rest of the atlas. Each tool is {name, description, input_schema, risk, run} plus,
   where it applies, origins (the sites it will contact, so the loop can ask for access first), confirm (the wording of
   the approval card), summary (one line for the activity log), viewer: false (needs the network, so it is not offered
   inside the Claude viewer) and max (how many characters of result go back to the model).
     atlas_*       read the atlas: markets, places with sourced facts, service angles, competitors, weather, the brand
     forge_*       the Site Forge (module 09): its plan, its pages, its settings (changed through its own controls)
     page_*        the workshop: pages Dr. HVAC builds or adopts, checked, previewed, exported, handed to Publish
     elementor_*   Elementor documents: load, outline, slots, edit, undo, turn into a page, export
     wp_*          the connected WordPress site (12_dr_wp.js)
     fetch_url, site_audit, sitemap_read, dns_lookup, host_fingerprint, migration_*, redirect_map
     file_*, site_build, copy_check, ask_user, dashboard_open
   Risk decides the gate in 03_dr_agent.js: read and local run; draft asks unless Settings allows drafts; live always asks.
   The dashboard's own globals (DATA, CITIES, FORGE, FORGE_COMPILE, CMS, BRAND, MODI, satchelLint, houseClean) are read
   where a tool needs them and reported missing in plain words when a build lacks one; nothing here runs at load time. */
DRHVAC.tools = (() => {
  const D = DRHVAC; const E = () => D.elementor; const bus = D.bus;
  const T = []; const BY = {};
  const def = t => { if (BY[t.name]) throw new Error('duplicate tool ' + t.name); T.push(t); BY[t.name] = t; };
  const obj = (properties, required) => ({ type: 'object', properties: properties || {}, required: required || [], additionalProperties: false });
  const S = { str: d => ({ type: 'string', description: d }), int: d => ({ type: 'integer', description: d }), num: d => ({ type: 'number', description: d }), bool: d => ({ type: 'boolean', description: d }), arr: (items, d) => ({ type: 'array', items, description: d }), en: (vals, d) => ({ type: 'string', enum: vals, description: d }), any: d => ({ type: 'object', description: d }) };
  class ToolError extends Error { constructor(msg, hint) { super(msg); this.name = 'ToolError'; this.hint = hint || ''; } }
  const need = (ok, msg, hint) => { if (!ok) throw new ToolError(msg, hint); };
  const has = { data: () => typeof DATA !== 'undefined' && typeof CITIES !== 'undefined', forge: () => typeof FORGE !== 'undefined' && typeof FORGE_COMPILE !== 'undefined', cms: () => typeof CMS !== 'undefined', brand: () => typeof BRAND !== 'undefined', mods: () => typeof MODI !== 'undefined' && typeof showModule === 'function', dom: () => typeof document !== 'undefined' && !!document.querySelector };
  const clean = s => (typeof houseClean === 'function' ? houseClean(s) : s);
  const rnd = (v, d) => (v == null || !isFinite(+v) ? null : +(+v).toFixed(d == null ? 0 : d));
  const pct = (a, b) => (b ? rnd(100 * a / b, 1) : null);

  /* ============================ the workshop: pages, Elementor documents, files ============================ */
  let WS = { v: 1, pages: {}, docs: {}, files: {}, current: '' }; let wsReady = false;
  const BLOBS = new Map();                       /* file id → Blob, for attachments that are not text (kept in memory only) */
  const UNDO = new Map();                        /* doc id → [earlier element trees], newest last, this session only */
  let saveT = null;
  const saveWs = () => { clearTimeout(saveT); saveT = setTimeout(() => { D.big.set('workshop', WS); }, 250); };
  const ready = () => (wsReady ? Promise.resolve() : D.big.get('workshop', null).then(v => { if (D.isObj(v) && v.pages) WS = Object.assign({ v: 1, pages: {}, docs: {}, files: {}, current: '' }, v); wsReady = true; }));
  const touch = (kind, id) => { saveWs(); bus.emit('workshop', { kind, id }); };
  const page = id => { const p = WS.pages[id] || Object.values(WS.pages).find(x => x.slug === id); need(p, `No workshop page "${id}".`, 'page_list shows the ids.'); return p; };
  const doc = id => { const d = WS.docs[id]; need(d, `No Elementor document "${id}" in the workshop.`, 'elementor_load loads one; file_list and page_list show what exists.'); return d; };
  const file = id => { const f = WS.files[id]; need(f, `No file "${id}".`, 'file_list shows the ids.'); return f; };
  const summary = () => ({ pages: Object.keys(WS.pages).length, docs: Object.keys(WS.docs).length, files: Object.keys(WS.files).length, current: WS.current && WS.pages[WS.current] ? '/' + WS.pages[WS.current].slug + '/' : '' });
  /* files: text is kept (and saved with the workshop); anything else lives as a Blob for this session */
  function addFile(o) {
    const id = D.uid('f'); const f = { id, name: String(o.name || 'file.txt').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120), mime: o.mime || 'text/plain', kind: o.kind || 'deliverable', size: 0, at: D.nowIso(), note: o.note || '' };
    if (typeof o.text === 'string') { f.text = o.text; f.size = D.bytesOf(o.text); } else if (o.blob) { BLOBS.set(id, o.blob); f.size = o.blob.size || 0; f.binary = true; }
    WS.files[id] = f; touch('file', id); return f;
  }
  const fileBlob = id => BLOBS.get(id) || null;
  function removeFile(id) { delete WS.files[id]; BLOBS.delete(id); touch('file', id); }
  function removePage(id) { delete WS.pages[id]; if (WS.current === id) WS.current = ''; touch('page', id); }
  function removeDoc(id) { delete WS.docs[id]; UNDO.delete(id); touch('doc', id); }
  function setCurrent(id) { if (WS.pages[id]) { WS.current = id; touch('current', id); } }
  async function clearWorkshop() { WS = { v: 1, pages: {}, docs: {}, files: {}, current: '' }; BLOBS.clear(); UNDO.clear(); await D.big.set('workshop', WS); bus.emit('workshop', { kind: 'all' }); }

  /* ============================ the Site Forge, read from outside ============================ */
  const forgeMod = () => { need(has.mods() && MODI.forge, 'The Site Forge (module 09) is not in this build.'); const m = MODI.forge; if (!m.mounted) { m.mounted = true; m.mount(document.querySelector('#mod-forge')); } return m; };
  /* the forge's settings as it would plan with them: its defaults under what it has saved in this browser */
  function forgeCfg() {
    need(has.forge(), 'The Site Forge engine is not loaded in this build.');
    const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; };
    let saved = {}; try { saved = (typeof store !== 'undefined' ? store.get('tda.forge.v1', {}) : {}) || {}; } catch (e) { saved = {}; }
    return merge(FORGE.defaultCfg(), saved);
  }
  /* the parts every page of this business shares, taken from a page the forge itself writes: the site block, the schema
     entity, the calls to action, the trust strip, the form with its consent text, and the license notice */
  function skeleton(lang) {
    const cfg = forgeCfg(); const base = FORGE.defaultCfg(); const c2 = D.clone(cfg); c2.build = Object.assign({}, base.build, { home: true, about: false, service: false, careers: false, counties: false, cities: false, landing: false, es: false, guides: false }); c2.edits = {}; c2.removed = {};
    const pl = FORGE.plan(c2); const home = pl.pages.find(p => p.kind === 'home'); need(home, 'The Site Forge could not plan a base page.');
    const live = FORGE.parseLive(cfg.site.live, cfg.site.url); const bp = FORGE.blueprint(home, c2, pl.pages, live, pl.markets);
    const notice = bp.sections.find(s => s.id === 'notice') || null;
    if (lang === 'es-US' && typeof FCOPY !== 'undefined' && FCOPY.ES) { bp.page.conversion.form = Object.assign({}, bp.page.conversion.form, { button: FCOPY.ES.form.button, consent: FCOPY.ES.form.consent, fields: FCOPY.ES.form.fields }); bp.page.conversion.trust = (FCOPY.ES.trust || []).map(x => FORGE.fill(x, FORGE.baseVars(cfg, pl.markets))).filter(Boolean).slice(0, 3); }
    return { cfg, site: bp.site, entity: bp.page.entity, cta: bp.page.cta, conversion: bp.page.conversion, author: bp.page.author || null, notice, live };
  }
  const TEXT_KEYS = new Set(['eyebrow', 'lede', 'body', 'text', 'heading', 'caption', 'title', 'label', 'q', 'a', 'quote', 'role', 'value', 'source', 'anchor', 'description', 'transcript', 'link', 'name', 'h1']);
  const cleanHtml = h => String(h).split(/(<[^>]+>)/).map(p => (p.startsWith('<') || !p.trim() ? p : (m => m[1] + clean(m[2]) + m[3])(p.match(/^(\s*)([\s\S]*?)(\s*)$/)))).join('');
  /* house style on every text field of a section list, the way the forge cleans its own (urls, ids and media keys untouched) */
  function cleanDeep(x, key) {
    if (typeof x === 'string') return key === 'html' ? cleanHtml(x) : TEXT_KEYS.has(key) ? clean(x) : x;
    if (Array.isArray(x)) return x.map(v => cleanDeep(v, key === 'rows' || key === 'columns' ? 'text' : key));
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = (k === 'url' || k === 'media' || k === 'id' || k === 'type' || k === 'icon' || k === 'cta') ? x[k] : cleanDeep(x[k], k); return o; }
    return x;
  }
  const SECTION_TYPES = ['hero', 'answer', 'key_facts', 'rich_text', 'steps', 'features', 'media', 'video', 'gallery', 'testimonials', 'stats', 'faq', 'cta_band', 'form', 'map', 'table', 'authors', 'links', 'html'];
  /* what a section must carry for the compiler not to fall over; returned as plain problems */
  function sectionProblems(sec, i) {
    const out = []; const at = `sections[${i}]`; if (!D.isObj(sec)) return [`${at} is not an object`]; if (!SECTION_TYPES.includes(sec.type)) return [`${at}.type "${sec.type}" is not a section type (${SECTION_TYPES.join(', ')})`];
    const list = (k, shape) => { if (!Array.isArray(sec[k]) || !sec[k].length) out.push(`${at} (${sec.type}) needs ${k}: a list of ${shape}`); };
    const str = k => { if (typeof sec[k] !== 'string' || !sec[k].trim()) out.push(`${at} (${sec.type}) needs ${k}`); };
    if (sec.type === 'answer') str('body'); if (sec.type === 'key_facts' || sec.type === 'stats') list('items', '{value, label}'); if (sec.type === 'rich_text' || sec.type === 'html') str('html');
    if (sec.type === 'steps') list('steps', '{title, text}'); if (sec.type === 'features') { str('heading'); list('items', '{title, text}'); } if (sec.type === 'faq') list('items', '{q, a}'); if (sec.type === 'testimonials') list('items', '{quote, name}');
    if (sec.type === 'cta_band') str('heading'); if (sec.type === 'map') str('address'); if (sec.type === 'table') { list('columns', 'column names'); list('rows', 'rows (each a list of cells)'); } if (sec.type === 'gallery') list('media', 'media keys'); if (sec.type === 'media' || sec.type === 'video') str('media');
    return out;
  }

  /* ============================ pages: build, check, hand over ============================ */
  /* the media map a compile gets: video urls, files attached in this session (as object urls), nothing else */
  function mediaFor(bp, forPublish) {
    const view = {}, pub = {};
    for (const [k, spec] of Object.entries((bp && bp.media) || {})) {
      const src = String((spec && spec.source) || ''); const base = { id: 0, alt: (spec && spec.alt) || '', kind: (spec && spec.kind) || 'image' };
      if (/^https?:/.test(src)) { view[k] = pub[k] = Object.assign({}, base, { url: src }); }
      else if (src.startsWith('file:')) { const f = WS.files[src.slice(5)]; const b = f ? fileBlob(f.id) : null; if (b && typeof URL !== 'undefined' && URL.createObjectURL) { const u = (f._url = f._url || URL.createObjectURL(b)); view[k] = Object.assign({}, base, { url: u }); pub[k] = Object.assign({}, base, { url: u, mime: f.mime, asset: { blob: b, file: f.name, mime: f.mime } }); } else pub[k] = Object.assign({}, base, { url: '', missing: src }); }
      else if (src.startsWith('library:')) pub[k] = Object.assign({}, base, { url: '', library: src.slice(8) });
      else if (src.startsWith('assets/')) pub[k] = Object.assign({}, base, { url: '', missing: src });
    }
    return forPublish ? { view, pub } : view;
  }
  const stripBp = bp => { const o = Object.assign({}, bp); delete o._facts; delete o._missing; return o; };
  const brandColors = () => (has.brand() ? BRAND.colors || {} : {});
  const wrapDoc = (title, desc, css, body, schema, lang, noindex, after) => `<!DOCTYPE html><html lang="${D.escHtml((lang || 'en-US').slice(0, 2))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${D.escHtml(title || '')}</title>${desc ? `<meta name="description" content="${D.escHtml(desc)}">` : ''}${noindex ? '<meta name="robots" content="noindex,follow">' : ''}<style>*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1b1b1a;background:#fff}img{max-width:100%;height:auto}${css || ''}</style>${schema ? '<scr' + 'ipt type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</scr' + 'ipt>' : ''}</head><body><main>${body || ''}</main>${after || ''}</body></html>`;
  /* the type a theme would give the page: the brand's two families over system fallbacks, so a preview does not fall back to a serif */
  const typeCss = () => { const F = (has.brand() && BRAND.fonts) || {}; const q = n => (n ? `"${String(n).replace(/["\\<>;{}]/g, '')}",` : ''); const sys = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'; return `body{font-family:${q(F.body)}${sys}}h1,h2,h3,h4{font-family:${q(F.display)}${sys};line-height:1.15;margin:.2em 0 .5em}h1{font-size:clamp(30px,4.2vw,48px)}h2{font-size:clamp(24px,3vw,34px)}h3{font-size:20px}a{color:inherit}`; };
  /* build(p) → {html (the section markup), preview (a whole document), checks {block, warn, note, issues}, words, portable() } */
  function build(p) {
    if (p.kind === 'blueprint') {
      need(has.forge(), 'The Site Forge compiler is not loaded, so a blueprint page cannot be built in this view.');
      const bp = p.blueprint; const r = FORGE_COMPILE.compile(stripBp(bp), mediaFor(bp)); bp._facts = bp._facts || []; bp._missing = [];
      let ch; try { ch = FORGE.checks(bp, r, forgeCfg()); } catch (e) { ch = { issues: [{ id: 'CHECKS', sev: 'warn', where: 'checks', msg: 'The Site Forge checks could not run: ' + e.message }], block: 0, warn: 1, note: 0 }; }
      /* The preview is the markup that is published under the stylesheet that is published with it (CMS.brandCss), which is
         also what the audit reads; the compiler's own preview uses a second stylesheet that differs from it in places. The
         sticky call bar comes from the compiled Elementor data, where it carries its own style. */
      const css = has.cms() ? CMS.brandCss(brandColors()) : null; const pg = bp.page || {}; let sticky = '';
      try { E().walk(r.elementor_data || [], el => { const h = el.widgetType === 'html' && el.settings ? String(el.settings.html || '') : ''; if (!sticky && h.includes('forge-sticky')) sticky = h; }); } catch (e) { sticky = ''; }
      const preview = css == null ? r.preview : wrapDoc(pg.title, pg.meta_description, typeCss() + css, r.html, r.schema, pg.language, pg.noindex, sticky);
      return { html: r.html, css, preview, schema: r.schema, elementor: r.elementor_data, template: r.template, checks: ch, words: FORGE.wordCount(bp), r,
        portable: () => { const m = mediaFor(bp, true); const r2 = FORGE_COMPILE.compile(stripBp(bp), m.view); return CMS.pageFromForge(stripBp(bp), r2, m.pub, { label: 'Dr. HVAC', kind: 'Workshop', checks: ch, words: FORGE.wordCount(bp) }); } };
    }
    const pg = p.page || {}; const title = pg.title || p.title || ''; const issues = [];
    let html, css, schema = p.schema || null, elementor = null, pageSettings = null;
    if (p.kind === 'elementor') { const r = E().toHtml(p.doc.elements); html = r.html; css = r.css; elementor = p.doc.elements; pageSettings = Object.assign({ hide_title: 'yes' }, p.doc.page_settings || {}, pg.template ? { template: pg.template } : {}); const v = E().validate(elementor); v.errors.forEach(m => issues.push({ id: 'ELEMENTOR', sev: 'block', where: 'structure', msg: m })); v.warnings.forEach(m => issues.push({ id: 'ELEMENTOR', sev: 'note', where: 'structure', msg: m })); }
    else { html = String(p.html || ''); css = p.css == null ? (has.cms() ? CMS.brandCss(brandColors()) : '') : String(p.css); }
    const text = has.cms() ? CMS.stripTags(html) : html.replace(/<[^>]+>/g, ' ');
    if (typeof satchelLint === 'function') { const lic = has.brand() ? BRAND.lic : ''; try { satchelLint(text, { web: true }).concat(satchelLint(text, { page: true, needLic: true, lic }).filter(l => /^TDLR/.test(l.rule.id))).forEach(l => { if (!issues.some(x => x.id === l.rule.id)) issues.push({ id: l.rule.id, sev: l.rule.sev, where: 'copy', ev: l.ev, msg: l.rule.name, cite: l.rule.cite, fix: l.rule.fix }); }); } catch (e) { } }
    if (title.length > 60) issues.push({ id: 'LEN', sev: 'warn', where: 'title', msg: `Title is ${title.length} characters (60 or fewer)` });
    const md = (pg.meta_description || '').length; if (md < 70 || md > 160) issues.push({ id: 'LEN', sev: 'warn', where: 'meta description', msg: `Meta description is ${md} characters (aim for 120 to 158)` });
    if (/lorem ipsum|\[\[verify|todo:/i.test(text)) issues.push({ id: 'PLACEHOLDER', sev: 'block', where: 'copy', msg: 'Placeholder text is still on the page' });
    const n = s => issues.filter(x => x.sev === s).length; const ch = { issues, block: n('block'), warn: n('warn'), note: n('note') };
    const words = (text.match(/\S+/g) || []).length;
    const preview = wrapDoc(title, pg.meta_description, typeCss() + css, html, schema, pg.language, pg.noindex);
    return { html, css, preview, schema, elementor, checks: ch, words,
      portable: () => { const pp = CMS.pageFromHtml({ title, h1: pg.h1 || title, slug: p.slug, meta_description: pg.meta_description || '', summary: pg.summary || '', language: pg.language || 'en-US', post_type: pg.post_type || 'page', template: pg.template || 'default', html, css, schema, noindex: !!pg.noindex, canonical: pg.canonical || '', elementor_data: elementor, page_settings: pageSettings, brand: brandColors() }); pp.label = 'Dr. HVAC'; pp.kind = p.kind === 'elementor' ? 'Elementor' : 'HTML'; pp.checks = ch; pp.words = words; pp.lint = issues.filter(i => i.sev === 'block').map(i => 'BLOCK: ' + i.msg); return pp; } };
  }
  /* where a page keeps its fields: a blueprint inside the blueprint, the other two kinds beside the content */
  const pageFields = p => (p.kind === 'blueprint' ? ((p.blueprint && p.blueprint.page) || {}) : (p.page || {}));
  const brief = p => { let b = null, err = ''; try { b = build(p); } catch (e) { err = e.message; } const pg = pageFields(p); return { id: p.id, slug: p.slug, kind: p.kind, title: pg.title || p.title || '', h1: pg.h1 || '', noindex: !!pg.noindex, words: b ? b.words : null, checks: b ? { block: b.checks.block, warn: b.checks.warn, note: b.checks.note } : null, error: err || undefined, updated: p.updated, source: p.source || '' }; };
  const issueLines = ch => ch.issues.slice(0, 30).map(i => `${i.sev.toUpperCase()} ${i.id}: ${i.msg}${i.ev ? ' [' + i.ev + ']' : ''}${i.where ? ' (' + i.where + ')' : ''}${i.fix ? ' Fix: ' + i.fix : ''}`);
  function putPage(p) { p.updated = D.nowIso(); if (!p.created) p.created = p.updated; WS.pages[p.id] = p; WS.current = p.id; touch('page', p.id); return p; }
  const uniqueSlug = (slug, selfId) => { let s = D.slugify(slug) || 'page', n = 2; while (Object.values(WS.pages).some(x => x.slug === s && x.id !== selfId)) s = (D.slugify(slug) || 'page') + '-' + (n++); return s; };

  /* a blueprint from the model's page fields and sections, on the business's skeleton */
  /* The calls to action point at "#contact" and "#how-it-works", and the Site Forge gives its form and its steps those
     ids. The same here when the author named none: the first form answers #contact, the first steps #how-it-works. */
  function anchorSections(secs, cta) {
    const ids = new Set(secs.map(s => s.id).filter(Boolean));
    const targets = [cta && cta.primary && cta.primary.url, cta && cta.secondary && cta.secondary.url].filter(u => typeof u === 'string' && u[0] === '#').map(u => u.slice(1));
    const give = (id, type) => { if (!targets.includes(id) || ids.has(id)) return; const s = secs.find(x => x.type === type && !x.id); if (s) { s.id = id; ids.add(id); } };
    give('contact', 'form'); give('how-it-works', 'steps'); return secs;
  }
  /* exact text replacement through every piece of copy in a value; keys that hold structure (ids, types, urls, media keys) are left alone */
  const NOT_COPY = new Set(['type', 'id', 'style', 'width', 'layout', 'url', 'href', 'src', 'source', 'media', 'poster', 'icon', 'slug', 'archetype', 'template', 'language', 'post_type', 'kind', 'forge', 'canonical', 'entity', 'dates', 'site', 'schema_extra']);
  function replaceCopy(v, find, to) {
    let n = 0; if (!find) return 0;
    const walk = x => { if (Array.isArray(x)) { x.forEach((y, i) => { if (typeof y === 'string') { const c = y.split(find).length - 1; if (c) { x[i] = y.split(find).join(to); n += c; } } else walk(y); }); } else if (D.isObj(x)) { for (const k of Object.keys(x)) { if (NOT_COPY.has(k) || k[0] === '_') continue; const y = x[k]; if (typeof y === 'string') { const c = y.split(find).length - 1; if (c) { x[k] = y.split(find).join(to); n += c; } } else walk(y); } } };
    walk(v); return n;
  }
  function makeBlueprint(pg, sections, media) {
    const sk = skeleton(pg.language); const probs = []; (sections || []).forEach((s, i) => probs.push(...sectionProblems(s, i)));
    need(Array.isArray(sections) && sections.length, 'A blueprint page needs sections.'); need(!probs.length, 'The sections do not fit the blueprint: ' + probs.slice(0, 6).join('; '), 'Each section type lists its fields in the system prompt.');
    need(sections.filter(s => s.type === 'hero').length === 1, 'A page needs exactly one hero section.');
    const landing = pg.archetype === 'landing'; const secs = cleanDeep(sections).map(s => Object.assign({}, s));
    const mkeys = Object.keys(media || {}); secs.forEach(s => { if (s.type === 'hero' && s.media && !mkeys.includes(s.media)) delete s.media; if (s.type === 'hero' && !s.layout) s.layout = s.media ? (landing ? 'cover' : 'split') : 'center'; });
    if (sk.notice && !secs.some(s => s.id === 'notice')) { const at = secs.map(s => s.type).lastIndexOf('links'); secs.splice(at >= 0 ? at : secs.length, 0, D.clone(sk.notice)); }
    const today = new Date().toISOString().slice(0, 10); const cta = D.clone(sk.cta);
    if (D.isObj(pg.cta)) { if (D.isObj(pg.cta.primary)) Object.assign(cta.primary, pg.cta.primary); if (D.isObj(pg.cta.secondary)) cta.secondary = Object.assign({}, cta.secondary || {}, pg.cta.secondary); }
    if (cta.primary && cta.primary.label) cta.primary.label = clean(cta.primary.label);
    anchorSections(secs, cta);
    const conversion = D.clone(sk.conversion); if (Array.isArray(pg.trust) && pg.trust.length) conversion.trust = pg.trust.slice(0, 3).map(clean); if (pg.sticky_mobile_bar === false) conversion.sticky_mobile_bar = false;
    const page = { archetype: pg.archetype || 'landing', post_type: pg.post_type === 'post' ? 'post' : 'page', slug: pg.slug, title: clean(pg.title || pg.h1 || ''), h1: clean(pg.h1 || pg.title || ''), meta_description: clean(pg.meta_description || ''), language: pg.language || 'en-US', template: pg.template || (landing ? 'elementor_canvas' : (sk.cfg.site.template || 'default')), breadcrumbs: Array.isArray(pg.breadcrumbs) ? pg.breadcrumbs : [], summary: clean(pg.summary || ''), entity: sk.entity, dates: { published: today, modified: today }, cta, conversion, internal_links: Array.isArray(pg.internal_links) ? pg.internal_links.map(l => ({ anchor: clean(l.anchor), url: l.url })) : [], schema_extra: [] };
    if (pg.noindex != null ? pg.noindex : landing) page.noindex = true; if (pg.canonical) page.canonical = pg.canonical; if (D.isObj(pg.service)) page.service = pg.service; if (sk.author) page.author = sk.author;
    return { forge: '1', site: sk.site, page, media: media || {}, sections: secs, _facts: [], _missing: [] };
  }

  /* ============================ ATLAS ============================ */
  const city = name => { need(has.data(), 'The atlas data is not loaded.'); const n = String(name || '').trim().toLowerCase(); const c = CITIES.find(x => x.name.toLowerCase() === n) || CITIES.find(x => x.name.toLowerCase().startsWith(n)); need(c, `No city "${name}" in the atlas.`, 'atlas_markets lists the 120 cities it models.'); return c; };
  const cityRow = c => ({ city: c.name, county: c.cty, population: c.pop, median_year_built: rnd(c.medyr), central_systems: rnd(c.sys), systems_15_or_older: rnd(c.ge15), share_15_or_older_pct: pct(c.ge15, c.sys), r22_era_systems: rnd(c.r22), gas_furnaces_20_or_older: rnd(c.furn20), gas_heat_pct: rnd(c.gas_sh, 1), replacements_a_year: rnd(c.rep), replacement_dollars_a_year: rnd(c.opp_usd), median_home_value: rnd(c.value), median_income: rnd(c.inc) });
  const hav = (a, b, c, d) => { const t = Math.PI / 180; const x = Math.sin((c - a) * t / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin((d - b) * t / 2) ** 2; return 2 * 3958.8 * Math.asin(Math.sqrt(x)); };
  const FACT_KEYS = { city: ['c_sys', 'c_ge15', 'c_r22', 'c_medyr', 'c_origwin', 'c_furn20', 'c_gas', 'c_hp', 'c_rent', 'c_duct', 'c_rep'], county: ['k_sys', 'k_ge15', 'k_hail', 'k_hail175', 'k_big', 'k_lic', 'k_tech', 'k_gas', 'k_furn20'], metro: ['ac_life', 'furn_life', 'hp_life', 'mrl15', 'm_ge15', 'm_r22', 'm_rep', 'ticket', 'd100', 'cdd', 'fwheat', 'r22stop', 'a2l', 'uri'] };
  function facts(kind, p) { if (!has.forge()) return []; const cfg = forgeCfg(); const V = FORGE.varsFor(p, cfg, FORGE.markets(cfg)); return FACT_KEYS[kind].map(k => FORGE.factItem(k, V)).filter(Boolean).map(f => ({ key: f.key, value: f.value, label: f.label, source: f.source, grade: f.grade })); }

  def({ name: 'atlas_overview', risk: 'read', description: 'The atlas at a glance: the metro totals of its HVAC model, how many cities, ZIP codes and counties it covers, the modules, the service angles, and what is connected (WordPress, publish targets). Call it first when you need to know what data exists.',
    input_schema: obj({}),
    run() {
      need(has.data(), 'The atlas data is not loaded.'); const M = META; const out = { compiled: M.compiled, area: 'the 12 counties of Dallas Fort Worth', cities: CITIES.length, zip_codes: Z.length, counties: CO.map(c => c.name), central_systems: rnd(M.sys), systems_15_or_older: rnd(M.ge15), r22_era_systems: rnd(M.r22), replacements_a_year: rnd(M.rep), note: 'System counts and ages are model estimates (grade C) from Census housing data and EIA RECS equipment ages; say "estimated" on a page and print the source atlas_place gives.' };
      if (has.mods()) out.modules = MODS.map(m => ({ key: m.key, num: m.num, title: m.title }));
      if (typeof ANGLES !== 'undefined') out.service_angles = ANGLES.map(a => ({ id: a.id, name: a.short, has_page_copy: !!(typeof FCOPY !== 'undefined' && FCOPY.AC[a.id]) }));
      if (has.brand()) out.brand = { name: BRAND.name, city: BRAND.city, phone: BRAND.phone, domain: BRAND.domain, license_on_file: !!BRAND.lic };
      out.connected = { wordpress: D.wp && D.wp.configured() ? D.hostOf(D.wp.site()) : null, publish_targets: has.cms() && CMS.isReady() ? CMS.list().filter(a => CMS.status(a.id).state !== 'unconfigured').map(a => ({ id: a.id, name: a.name, state: CMS.status(a.id).state })) : [], network: D.canNetwork() };
      return out;
    } });

  def({ name: 'atlas_markets', risk: 'read', description: 'Rank the cities the atlas models, to choose where a page or campaign should point. Metrics: replacements (modeled system replacements a year), dollars (replacement dollars a year), aged (systems 15 years or older), aged_share (share 15 or older), r22 (systems from before 2010), furnaces (gas furnaces 20 or older), income, home_value, population. Filter by county, by distance from the office, by minimum population, or by a name search.',
    input_schema: obj({ metric: S.en(['replacements', 'dollars', 'aged', 'aged_share', 'r22', 'furnaces', 'income', 'home_value', 'population'], 'What to rank by. Default replacements.'), limit: S.int('How many cities, 1 to 60. Default 12.'), county: S.str('A county name, to keep only its cities.'), within_miles: S.num('Keep cities within this many miles of the brand\'s office.'), min_population: S.int('Smallest city to include.'), search: S.str('Part of a city name.') }),
    run(i) {
      need(has.data(), 'The atlas data is not loaded.'); const f = { replacements: c => c.rep, dollars: c => c.opp_usd, aged: c => c.ge15, aged_share: c => (c.sys ? c.ge15 / c.sys : 0), r22: c => c.r22, furnaces: c => c.furn20, income: c => c.inc, home_value: c => c.value, population: c => c.pop }[i.metric || 'replacements'];
      const B = has.brand() ? BRAND : {}; let list = CITIES.slice();
      if (i.county) list = list.filter(c => String(c.cty).toLowerCase() === String(i.county).toLowerCase().replace(/ county$/, ''));
      if (i.min_population) list = list.filter(c => (c.pop || 0) >= i.min_population);
      if (i.search) list = list.filter(c => c.name.toLowerCase().includes(String(i.search).toLowerCase()));
      const dist = c => (isFinite(+B.lat) && isFinite(+c.lat) ? hav(+B.lat, +B.lon, c.lat, c.lon) : null);
      if (i.within_miles) list = list.filter(c => { const d = dist(c); return d != null && d <= i.within_miles; });
      list.sort((a, b) => (f(b) || 0) - (f(a) || 0));
      return { metric: i.metric || 'replacements', matched: list.length, cities: list.slice(0, Math.max(1, Math.min(60, i.limit || 12))).map(c => Object.assign(cityRow(c), { miles_from_office: rnd(dist(c), 1) })) };
    }, summary: (i, o) => `${o.matched} cities by ${o.metric}` });

  def({ name: 'atlas_place', risk: 'read', description: 'Everything the atlas knows about one place, ready to print on a page: for a city, its housing and HVAC stock numbers plus facts worded for publication, each with the public source to print beside it and a confidence grade (A observed, B derived, C modeled estimate); for a county, hail, license and stock facts; for a ZIP code, its row of the model. Give exactly one of city, county or zip. Also returns the metro wide facts (equipment lifetimes, climate, refrigerant dates) when metro is true. Use these values and sources as they are; do not round or reword a figure into a different claim.',
    input_schema: obj({ city: S.str('City name, for example Frisco.'), county: S.str('County name, for example Collin.'), zip: S.str('Five digit ZIP code.'), metro: S.bool('Also return the Dallas Fort Worth wide facts.') }),
    run(i) {
      need(has.data(), 'The atlas data is not loaded.'); const out = {};
      if (i.city) { const c = city(i.city); out.city = cityRow(c); out.zip_codes = c.zips || []; out.printable_facts = facts('city', { kind: 'city', city: c.name, fips: c.fips }); out.county_facts = facts('county', { kind: 'county', fips: c.fips }); const near = CITIES.filter(x => x !== c && x.pop >= 10000).map(x => [x.name, hav(c.lat, c.lon, x.lat, x.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 6).map(x => x[0]); out.nearby_cities = near; }
      else if (i.county) { const n = String(i.county).toLowerCase().replace(/ county$/, ''); const k = CO.find(x => x.name.toLowerCase() === n); need(k, `No county "${i.county}" in the atlas.`, 'atlas_overview lists the 12 counties.'); out.county = { name: k.name, population: k.pop, central_systems: rnd(k.sys), systems_15_or_older: rnd(k.ge15), r22_era_systems: rnd(k.r22), gas_heat_pct: rnd(k.gas_sh, 1), hail_reports_1in_since_2016: k.hail1_2016, contractor_licenses: k.lic_con, technician_licenses: k.lic_tech, new_homes_2015_2025: k.bps_u1_2015_25 }; out.printable_facts = facts('county', { kind: 'county', fips: k.fips }); out.cities = CITIES.filter(c => c.fips === k.fips).sort((a, b) => b.pop - a.pop).slice(0, 15).map(c => c.name); }
      else if (i.zip) { const z = ZI[String(i.zip).trim()]; need(z, `ZIP ${i.zip} is not in the atlas.`); out.zip = { zip: z.zip, city: z.city, county: z.cty, population: z.pop, median_income: z.inc, median_home_value: z.value, median_year_built: z.medyr, owner_share_pct: rnd(z.own_sh, 1), spanish_at_home_pct: rnd(z.span_sh, 1), central_systems: rnd(z.sys), share_15_or_older_pct: rnd(z.ge15_sh, 1), r22_share_pct: rnd(z.r22_sh, 1), heat_pump_share_pct: rnd(z.hp_sh, 1), gas_heat_pct: rnd(z.gas_sh, 1), replacements_a_year: rnd(z.rep), thermal_debt_index: rnd(z.idx, 1), tier: z.tier, competitors_within_8km: z.comp_n8 }; }
      else need(i.metro, 'Give a city, a county or a zip (or metro: true).');
      if (i.metro) out.metro_facts = facts('metro', { kind: 'home' });
      return out;
    }, summary: i => i.city || i.county || i.zip || 'metro' });

  def({ name: 'atlas_service', risk: 'read', description: 'The service angles the atlas advertises and writes pages for (AC repair, replacement, furnace, heat pump, ducts, maintenance and more). Without an angle: the list. With an angle id: its search keywords, ad headlines, the page copy the Site Forge holds for it (heading, lede, the direct answer, the questions it answers) and its busy months. Use it to match a landing page to the ads that will send traffic to it.',
    input_schema: obj({ angle: S.str('An angle id from the list, for example repair, replace, furnace, heatpump, duct, maint.') }),
    run(i) {
      need(typeof ANGLES !== 'undefined', 'The service angles are not loaded.'); const copy = typeof FCOPY !== 'undefined' ? FCOPY.AC : {};
      if (!i.angle) return { angles: ANGLES.map(a => ({ id: a.id, name: a.short, label: a.label, line: a.line, has_page_copy: !!copy[a.id], spanish_ads: !!a.es })) };
      const a = typeof ANG !== 'undefined' ? ANG[i.angle] : null; need(a, `No angle "${i.angle}".`, 'Call atlas_service without an angle for the list.'); const c = copy[a.id]; let months = null; try { months = typeof SLM !== 'undefined' && SLM.seasonFor ? SLM.seasonFor(a.line) : null; } catch (e) { months = null; }
      return { id: a.id, name: a.short, label: a.label, keywords: (a.kw || []).slice(0, 12), question_keywords: (a.kwq || []).slice(0, 8), ad_headlines: (a.h || []).slice(0, 8), ad_descriptions: (a.d || []).slice(0, 4), placeholders: 'Texts use {city}, {county}, {brand}, {lic}: fill them yourself.', page_copy: c ? { slug: c.slug, h1: c.h1, lede: c.lede, answer: c.answer, faq: (c.faq || []).map(f => f.q), related: c.related || [] } : null, busy_months: months };
    }, summary: i => i.angle || 'all angles' });

  def({ name: 'atlas_competitors', risk: 'read', description: 'The competitor locations the atlas maps (about 240 HVAC companies across DFW): name, city, rating and review count as recorded, services, brands, and how strong their site is in search. Filter by city or ZIP (nearest first) or search by name. Use it to see who a landing page competes with; never copy their wording, and never print a competitor\'s name or rating on a page.',
    input_schema: obj({ city: S.str('City to look around.'), zip: S.str('ZIP code to look around.'), search: S.str('Part of a company name.'), limit: S.int('How many, 1 to 40. Default 10.') }),
    run(i) {
      need(typeof COMP !== 'undefined', 'The competitor map is not loaded.'); let at = null; if (i.zip && ZI[i.zip]) at = ZI[i.zip]; else if (i.city) at = city(i.city);
      let list = COMP.filter(c => c.tier !== 'integrity' && (!i.search || String(c.name).toLowerCase().includes(String(i.search).toLowerCase())));
      if (at) list = list.map(c => [c, isFinite(+c.lat) ? hav(at.lat, at.lon, c.lat, c.lon) : 9999]).sort((a, b) => a[1] - b[1]).map(([c, d]) => Object.assign({ _mi: d }, c)); else list = list.slice().sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
      return { matched: list.length, competitors: list.slice(0, Math.max(1, Math.min(40, i.limit || 10))).map(c => ({ name: c.name, city: c.city, miles: c._mi != null ? rnd(c._mi, 1) : undefined, rating: c.rating, reviews: c.reviews, rating_source: c.rating_source, services: c.services, brands: c.brands, domain: c.domain, organic_keywords: c.org_kw, paid_keywords: c.paid_kw, tier: c.tier })) };
    }, summary: (i, o) => `${o.matched} competitors` });

  def({ name: 'atlas_weather', risk: 'read', description: 'What the weather layer says now: the coldest forecast low of the next seven nights and any active cold trigger, when the live data is loaded. Use it when a page or a banner should match the week (a freeze, a heat wave).',
    input_schema: obj({}),
    run() {
      if (typeof LIVE === 'undefined' || typeof TDA_LIVE === 'undefined' || !TDA_LIVE.derive) return { available: false, note: 'The live weather layer is not loaded in this view.' };
      let c = null; try { c = TDA_LIVE.derive.cold(LIVE.all(), new Date()); } catch (e) { c = null; } if (!c || !c.ok) return { available: false, note: 'No forecast in the store yet. The Live Data module refreshes it.' };
      return { available: true, stale: !!c.stale, coldest_low_f: c.minLow, headline: c.headline, sub: c.sub, active: !!c.active, actions: (c.actions || []).slice(0, 4) };
    } });

  def({ name: 'brand_get', risk: 'read', description: 'The business this atlas is built for, as the Brand panel holds it: names, phone, address, license, hours, colors, fonts, logo, services, service cities, financing partners, promotion, social profiles. Every page should match it.',
    input_schema: obj({}),
    run() { need(has.brand(), 'The brand is not loaded.'); const b = D.clone(BRAND); delete b.logoData; delete b.pixels; return b; } });

  def({ name: 'brand_update', risk: 'settings', description: 'Change brand fields in this browser (the Brand panel\'s values): for example the phone, the hours, the promotion, a color. The whole atlas reads them, so only change what the person asked to change. The person is shown the change and approves it first.',
    confirm: i => ({ title: 'Change the brand settings in this browser', detail: Object.entries((i && i.patch) || {}).map(([k, v]) => { const was = has.brand() ? BRAND[k] : undefined; const show = x => (x == null || x === '' ? 'nothing' : typeof x === 'object' ? JSON.stringify(x) : String(x)); return `${k}: ${D.clip(show(was), 80, '')} → ${D.clip(show(D.isObj(v) && D.isObj(was) ? Object.assign({}, was, v) : v), 80, '')}`; }).join('\n') + '\nEvery module of the atlas reads these.' }),
    input_schema: obj({ patch: S.any('Fields to change, for example {"phone": "(972) 555 0100", "colors": {"accent": "#edd21c"}}. Keys: name, short, tagline, phone, url, email, lic, street, city, zip, hours, plan, financing, promo, colors {primary, secondary, accent, dark}, fonts {display, body}, logoUrl.') }, ['patch']),
    run(i) {
      need(has.brand() && typeof BRANDX !== 'undefined', 'The brand is not loaded.'); const ok = ['name', 'short', 'tagline', 'phone', 'url', 'email', 'lic', 'street', 'city', 'zip', 'hours', 'plan', 'financing', 'promo', 'colors', 'fonts', 'logoUrl']; const patch = {}; const skipped = [];
      Object.keys(i.patch || {}).forEach(k => { if (!ok.includes(k)) return skipped.push(k); patch[k] = (k === 'colors' || k === 'fonts') ? Object.assign({}, BRAND[k], i.patch[k]) : i.patch[k]; });
      need(Object.keys(patch).length, 'Nothing to change: none of those keys is a brand field.'); if (patch.url) patch.domain = D.bareDomain(patch.url);
      BRANDX.save(patch); return { changed: Object.keys(patch), skipped };
    }, summary: (i, o) => 'changed ' + o.changed.join(', ') });

  def({ name: 'dashboard_open', risk: 'local', description: 'Show another module of the atlas to the person, optionally handing it something: cities for the Site Forge or the Campaign Desk ({"cities": ["Frisco", "Plano"]}), a ZIP for the Heat Desk. Use it when the person asks to go there, or as the last step of a job (for example opening Publish after handing pages over). It leaves this conversation on screen only until they come back, so do not call it in the middle of work.',
    input_schema: obj({ module: S.str('The module key: index, replace, rules, drivers, paid, ground, supply, desk, forge, satchel, dfw, lines, watch, weather, accounts, publish, heat, live.'), payload: S.any('What to hand over, when the module takes something.') }, ['module']),
    run(i) { need(has.mods(), 'The module shell is not available.'); need(MODI[i.module], `No module "${i.module}".`); showModule(i.module, i.payload || undefined); return { opened: MODI[i.module].title }; }, summary: i => i.module });

  /* ============================ SITE FORGE ============================ */
  def({ name: 'forge_plan', risk: 'read', description: 'The Site Forge\'s current plan (module 09): the site settings every page shares, the market cities, and every planned page with its type, slug, title, word count and check results. The Site Forge writes service, city, county, landing and guide pages from the atlas\'s own numbers; start from its pages when one already covers what the person wants, and copy one into the workshop (forge_to_workshop) to rework it.',
    input_schema: obj({ kind: S.en(['home', 'about', 'service', 'county', 'city', 'landing', 'guide'], 'Only this page type.'), search: S.str('Text to find in a page\'s label or slug.'), limit: S.int('How many pages to list. Default 40.') }),
    run(i) {
      const m = forgeMod(); const pages = m.publishPages(); const site = m.publishSite(); const cfg = forgeCfg(); const ms = FORGE.markets(cfg);
      const kl = FORGE.KL || {}; const want = i.kind ? kl[i.kind] : null; let list = pages.filter(p => (!want || p.kind === want) && (!i.search || (p.label + ' ' + p.slug).toLowerCase().includes(String(i.search).toLowerCase())));
      return { site: { brand: site.brand, url: site.url, phone: site.phone, city: site.city, license: site.lic, hours: site.hours, plan: site.plan, cta: site.cta_label + ' → ' + site.cta_url, template: site.template, form: site.form_provider, live_urls_known: FORGE.parseLive(site.live, site.url).items.length }, markets: ms.map(c => c.name), build: cfg.build, total_pages: pages.length, matched: list.length,
        pages: list.slice(0, Math.max(1, Math.min(120, i.limit || 40))).map(p => ({ slug: p.slug, type: p.kind, label: p.label, title: p.title, words: p.words, blocks: p.checks ? p.checks.block : 0, warnings: p.checks ? p.checks.warn : 0, noindex: !!p.noindex })) };
    }, summary: (i, o) => `${o.matched} of ${o.total_pages} pages` });

  def({ name: 'forge_page', risk: 'read', description: 'One page of the Site Forge plan, by slug: a summary with its checks and facts, or its blueprint (the full page definition you can reuse as a pattern), or its compiled HTML.',
    input_schema: obj({ slug: S.str('The page slug from forge_plan.'), part: S.en(['summary', 'blueprint', 'html'], 'What to return. Default summary.') }, ['slug']),
    run(i) {
      const m = forgeMod(); const p = m.publishPages().find(x => x.slug === String(i.slug).replace(/^\/+|\/+$/g, '')); need(p, `No Site Forge page with the slug "${i.slug}".`, 'forge_plan lists the slugs.');
      if (i.part === 'blueprint') return p.blueprint; if (i.part === 'html') return p.html;
      return { slug: p.slug, type: p.kind, label: p.label, title: p.title, h1: p.h1, meta_description: p.meta_description, words: p.words, noindex: !!p.noindex, template: p.template, sections: (p.blueprint.sections || []).map(s => s.type + (s.heading ? ': ' + s.heading : '')), internal_links: p.links, media_slots: Object.keys(p.media || {}), checks: p.checks ? issueLines(p.checks) : [] };
    }, max: 90000, summary: i => i.slug });

  def({ name: 'forge_set', risk: 'settings', confirm: i => ({ title: 'Change the Site Forge\'s settings (module 09)', detail: ['site', 'focus', 'build'].filter(g => D.isObj(i && i[g])).map(g => Object.entries(i[g]).map(([k, v]) => `${g}.${k} → ${D.clip(typeof v === 'object' ? JSON.stringify(v) : String(v), 90, '')}`).join('\n')).join('\n') + '\nThe forge replans its pages with these.' }), description: 'Change the Site Forge\'s settings through its own controls, exactly as the person would in module 09: site fields (shared by every page), the market focus, and what to build. The person is shown the change and approves it first; the forge then replans at once. Site keys: brand, url, phone, email, street, city, zip, lic, licName, hours, brands, plan, cta_label, cta_url, trust, about, video_url, form_shortcode, primary, accent, dark, font_heading, font_body, logo_url, template (default | elementor_header_footer | elementor_canvas), form_provider (html | elementor_pro | shortcode), sticky, noindex_landing, guides_as_posts, globals. Focus keys: scope (radius | county | all | pick), miles, metric, n, minPop, picks (city names). Build keys: home, about, service, careers, counties, cities, landing, es, guides (true or false), and angles, landingAngles, topics (lists of ids to switch ON; others are switched off).',
    input_schema: obj({ site: S.any('Site fields to set.'), focus: S.any('Focus fields to set.'), build: S.any('Build switches to set.') }),
    async run(i) {
      forgeMod(); need(has.dom(), 'The page is not available.'); const root = document.querySelector('#mod-forge'); const done = [], missed = []; const fire = (el, type) => el.dispatchEvent(new Event(type || 'change', { bubbles: true }));
      /* The forge reads every element that carries data-k when a site field changes, and its sortable table headers carry
         data-k too, which stops its own handler before it saves. The headers are set aside for the length of the event,
         so the forge reads its fields, saves and replans as it means to. All fields are set first, then one event. */
      const quietly = el => { const parked = [...root.querySelectorAll('[data-k]')].filter(x => typeof x.value !== 'string'); parked.forEach(x => { x.setAttribute('data-k-parked', x.getAttribute('data-k')); x.removeAttribute('data-k'); }); try { fire(el); } finally { parked.forEach(x => { x.setAttribute('data-k', x.getAttribute('data-k-parked')); x.removeAttribute('data-k-parked'); }); } };
      let lastSite = null;
      Object.entries(i.site || {}).forEach(([k, v]) => { const el = root.querySelector(`#f9s_${k}`); if (!el) return missed.push('site.' + k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : String(v); lastSite = el; done.push('site.' + k); });
      if (lastSite) quietly(lastSite);
      const f = i.focus || {}; const fmap = { scope: '#f9Scope', miles: '#f9Miles', metric: '#f9Metric', n: '#f9N', minPop: '#f9Min' }; let last = null;
      Object.entries(f).forEach(([k, v]) => { if (k === 'picks') { const el = root.querySelector('#f9Picks'); el.value = (Array.isArray(v) ? v : [v]).join(', '); last = el; done.push('focus.picks'); return; } const el = fmap[k] ? root.querySelector(fmap[k]) : null; if (!el) return missed.push('focus.' + k); el.value = String(v); last = el; done.push('focus.' + k); });
      if (last) fire(last);
      const b = i.build || {}; const chips = { angles: '#f9Angles', landingAngles: '#f9Land', topics: '#f9Topics' };
      Object.entries(b).forEach(([k, v]) => {
        if (chips[k]) { const want = new Set(Array.isArray(v) ? v : []); for (let guard = 0; guard < 60; guard++) { const btn = [...root.querySelectorAll(chips[k] + ' button')].find(x => (x.getAttribute('aria-pressed') === 'true') !== want.has(x.dataset.id)); if (!btn) break; btn.click(); } done.push('build.' + k); return; }
        const el = root.querySelector(`#f9Types [data-b="${k}"]`); if (!el) return missed.push('build.' + k); el.checked = !!v; if (typeof el.onchange === 'function') el.onchange(); else fire(el); done.push('build.' + k);
      });
      need(done.length || missed.length, 'Nothing to set: give site, focus or build.');
      /* the forge writes its settings to storage a moment after a change (a 400 ms debounce): wait for that, so the plan read back here and by the next tool is the new one */
      if (done.length) await D.sleep(520);
      const m = MODI.forge; const pages = m.publishPages();
      return { set: done, not_a_setting: missed, plan_now: { pages: pages.length, markets: FORGE.markets(forgeCfg()).map(c => c.name) } };
    }, summary: (i, o) => `${o.set.length} settings; ${o.plan_now.pages} pages planned` });

  def({ name: 'forge_to_workshop', risk: 'local', description: 'Copy a Site Forge page into the workshop as an editable blueprint page, so you can rework its sections and copy without changing the forge\'s plan. Returns the workshop page id.',
    input_schema: obj({ slug: S.str('The Site Forge page slug.'), new_slug: S.str('A different slug for the copy, when the original should stay as it is.') }, ['slug']),
    async run(i) {
      await ready(); const m = forgeMod(); const p = m.publishPages().find(x => x.slug === String(i.slug).replace(/^\/+|\/+$/g, '')); need(p, `No Site Forge page with the slug "${i.slug}".`);
      const bp = D.clone(p.blueprint); bp._facts = []; bp._missing = []; const slug = uniqueSlug(i.new_slug || bp.page.slug); bp.page.slug = slug;
      const w = putPage({ id: D.uid('p'), kind: 'blueprint', slug, title: bp.page.title, blueprint: bp, source: 'Site Forge: ' + p.label }); return Object.assign({ copied: true }, brief(w));
    }, summary: (i, o) => '/' + o.slug + '/' });

  return { def, list: () => T.slice(), get: n => BY[n] || null, defs: () => T.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })), ToolError, need, obj, S, has,
    ready, summary, get WS() { return WS; }, page, doc, file, addFile, fileBlob, removeFile, removePage, removeDoc, setCurrent, clearWorkshop, putPage, uniqueSlug, build, brief, pageFields, anchorSections, replaceCopy, issueLines, makeBlueprint, cleanDeep, sectionProblems, SECTION_TYPES, mediaFor, stripBp, wrapDoc, forgeCfg, forgeMod, skeleton, UNDO, touch, clean, brandColors };
})();
