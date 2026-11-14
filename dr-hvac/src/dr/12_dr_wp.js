/* ==== src/dr/12_dr_wp.js ==== */
/* ==== dr_wp ==== */
"use strict";
/* ============================ Dr. HVAC: the WordPress client ============================
   Three layers of the same site, used in this order of preference:
     drhvac/v1   the Dr. HVAC connector plugin (14_dr_connector_raw.js carries its source): read and edit pages, posts
                 and Elementor templates with a backup before every write, the kit, the menus, the move inventory
     forge/v1    the FORGE bridge the Publish module already uses: import a compiled page or a library template, find
                 media, list live URLs
     wp/v2       WordPress core: enough to list and read without either plugin, with no Elementor data
   Sign in: the Application Password saved on the Publish module's WordPress card (settings.wpTarget names the card), or
   DRHVAC.wp.use({url, user, appPass}). Every request goes through DRHVAC.net.get, so the browser app's site permission
   and the viewer's block apply here as everywhere. A non 2xx is never swallowed: it becomes a WpError with the site's own
   message, the status, the code and a hint that says what to change. No DOM, no app helpers. */
DRHVAC.wp = (() => {
  const D = DRHVAC;
  const NS = { dr: 'drhvac/v1', forge: 'forge/v1', wp: 'wp/v2' };
  const CONNECTOR_VERSION = '1.0.0';      /* DrHvac_Connector::VER this client was written against */
  let OVERRIDE = null;                    /* use({...}) */
  const FOUND = new Map();                /* base url → {at, dr, forge, name, ns} */
  const TTL = 5 * 60 * 1000;

  class WpError extends Error { constructor(msg, o) { super(msg); this.name = 'WpError'; Object.assign(this, o || {}); } }

  /* ---------- sign in ---------- */
  function cfg() {
    if (OVERRIDE) return OVERRIDE;
    const C = typeof CMS !== 'undefined' ? CMS : null; if (!C || !C.cfg) return {};
    const id = D.settings().wpTarget || 'wp_elementor'; const c = C.cfg(id) || {}; if (c.url) return c;
    const alt = C.cfg(id === 'wp_elementor' ? 'wp_headless' : 'wp_elementor') || {}; return alt.url ? alt : c;
  }
  const use = c => { OVERRIDE = c ? { url: c.url, user: c.user, appPass: c.appPass } : null; FOUND.clear(); };
  const configured = () => { const c = cfg(); return !!(c.url && c.user && c.appPass); };
  const site = () => D.withScheme(String(cfg().apiBase || cfg().url || '').trim()).replace(/\/+$/, '');
  const url = path => site() + '/wp-json/' + String(path || '').replace(/^\//, '');
  function b64(s) { const bytes = new TextEncoder().encode(String(s)); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
  /* spaces in a pasted Application Password are fine: WordPress ignores them */
  const auth = () => { const c = cfg(); return 'Basic ' + b64(`${String(c.user || '').trim()}:${String(c.appPass || '').trim()}`); };

  /* ---------- one request ---------- */
  function hintFor(status, code, path) {
    const onDr = String(path).startsWith(NS.dr), onForge = String(path).startsWith(NS.forge);
    if (status === 401) return 'Check the username and the Application Password on the Publish module\'s WordPress card (Users, Profile, Application Passwords; the site needs HTTPS). A security plugin or the host can block sign in on the REST API.';
    if (status === 403 && (code === 'drhvac_caps' || code === 'forge_caps')) return 'Elementor data needs an administrator (the unfiltered_html capability). Sign in with an administrator account.';
    if (status === 403 && code === 'drhvac_publish') return 'This user may not publish. Use an Editor or Administrator account, or keep the page a draft.';
    if (status === 403) return 'This user may not do that here. Use an Editor or Administrator account and check that a security plugin is not blocking the REST API.';
    if (status === 404 && code === 'rest_no_route' && onDr) return 'The Dr. HVAC connector is not active on this site. Download it from Dr. HVAC (Connector plugin), then Plugins, Add New, Upload, Activate.';
    if (status === 404 && code === 'rest_no_route' && onForge) return 'The FORGE bridge is not active on this site. Download forge-bridge.zip from the Publish module, then Plugins, Add New, Upload, Activate.';
    if (status === 404 && code === 'rest_no_route') return 'No REST route. Set Settings, Permalinks to Post name and check that nothing disables the REST API.';
    if (status === 409 && code === 'drhvac_stale') return 'Someone changed this page on the site after it was read. Read it again, reapply the change, then write.';
    if (status === 413) return 'The request is larger than the site accepts (post_max_size on the host, or the connector\'s own limit).';
    if (status === 429) return 'The host or a security plugin rate limited the request. Wait a minute and try again.';
    return '';
  }
  async function req(method, path, body, o) {
    o = o || {}; if (!configured()) throw new WpError('No WordPress site is connected.', { status: 0, code: 'not_configured', hint: 'Fill in the WordPress card in the Publish module (site URL, username, Application Password) and press Test.' });
    const headers = { Authorization: auth(), Accept: 'application/json' }; let payload;
    if (body !== undefined && body !== null) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let r;
    try { r = await D.net.get(url(path), { method, headers, body: payload, timeout: o.timeout || 45000, signal: o.signal, maxBytes: 12000000 }); }
    catch (e) { throw new WpError(e.message, { status: 0, code: e.code || 'network', hint: 'Check the site URL and that the browser app may reach it.' }); }
    const j = D.safeParse(r.text, undefined);
    if (!r.ok) { const code = j && typeof j === 'object' ? String(j.code || '') : ''; const msg = (j && (j.message || j.code)) || D.clip(String(r.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 200, 'the response') || 'HTTP ' + r.status; throw new WpError(`${r.status} ${msg}`, { status: r.status, code, hint: hintFor(r.status, code, path), body: j, path }); }
    if (j === undefined) throw new WpError(`${D.hostOf(site())} answered ${r.status} but not with JSON. A cache or a security page may be in front of the REST API.`, { status: r.status, code: 'not_json', path });
    return { json: j, headers: r.headers, status: r.status };
  }
  const get = async (path, o) => (await req('GET', path, undefined, o)).json;
  const post = async (path, body, o) => (await req('POST', path, body, o)).json;
  const qs = q => { const p = Object.entries(q || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)); return p.length ? '?' + p.join('&') : ''; };

  /* ---------- what the site has: GET /wp-json/ lists the namespaces ---------- */
  async function discover(o, fresh) {
    const key = site(); const hit = FOUND.get(key); if (!fresh && hit && Date.now() - hit.at < TTL) return hit;
    const root = await get('', o); if (!root || !Array.isArray(root.namespaces)) throw new WpError(`No WordPress REST API at ${url('')}.`, { status: 0, code: 'no_rest', hint: 'Enter the WordPress install URL and set Settings, Permalinks to Post name.' });
    const rec = { at: Date.now(), dr: root.namespaces.includes(NS.dr), forge: root.namespaces.includes(NS.forge), name: root.name || '', home: root.home || root.url || key, ns: root.namespaces };
    FOUND.set(key, rec); return rec;
  }
  async function needConnector(what, o) { const d = await discover(o); if (!d.dr) throw new WpError(`${what} needs the Dr. HVAC connector on ${d.name || D.hostOf(site())}.`, { status: 0, code: 'no_connector', hint: 'Download the connector from Dr. HVAC (Connector plugin), then Plugins, Add New, Upload, Activate, and try again.' }); return d; }
  async function needBridge(what, o) { const d = await discover(o); if (!d.forge) throw new WpError(`${what} needs the FORGE bridge on ${d.name || D.hostOf(site())}.`, { status: 0, code: 'no_bridge', hint: 'Download forge-bridge.zip from the Publish module, then Plugins, Add New, Upload, Activate, and try again.' }); return d; }

  /* ---------- status: works with both plugins, one, or neither ---------- */
  async function status(o) {
    const d = await discover(o, true); const out = { ok: true, site: site(), name: d.name, rest: true, bridge: { on: d.forge, version: '' }, connector: { on: d.dr, version: '', current: false }, elementor: null, elementorPro: null, containers: false, theme: '', seo: '', user: '', can: {}, counts: null, warnings: [], missing: [] };
    if (d.dr) {
      const s = await get(NS.dr + '/status', o);
      Object.assign(out, { elementor: s.elementor || null, elementorPro: s.elementor_pro || null, containers: !!s.containers, theme: (s.theme && s.theme.name) || '', childTheme: !!(s.theme && s.theme.child), seo: s.seo_plugin || 'none', user: s.user || '', can: s.can || {}, counts: s.counts || null, wp: s.wp, php: s.php, permalinks: s.permalinks, kitId: s.kit_id || 0, multisite: !!s.multisite });
      out.connector.version = s.connector || ''; out.connector.current = s.connector === CONNECTOR_VERSION;
      if (!out.connector.current) out.warnings.push(`The connector on the site is ${s.connector}; this build ships ${CONNECTOR_VERSION}. Download the current one from Dr. HVAC.`);
    }
    if (d.forge) { try { const s = await get(NS.forge + '/status', o); out.bridge.version = s.forge || ''; if (!d.dr) Object.assign(out, { elementor: s.elementor || null, elementorPro: s.elementor_pro || null, containers: !!s.containers, theme: s.theme || '', seo: s.seo_plugin || 'none', user: s.user || '', can: { unfiltered_html: !!s.unfiltered_html, edit_pages: true }, wp: s.wp, php: s.php, permalinks: s.permalinks }); } catch (e) { out.warnings.push('The FORGE bridge did not answer its status route: ' + e.message); } }
    if (!d.dr && !d.forge) { const me = await get(NS.wp + '/users/me?context=edit', o); const caps = me.capabilities || {}; Object.assign(out, { user: me.slug || me.name || '', can: { edit_pages: !!caps.edit_pages, publish_pages: !!caps.publish_pages, unfiltered_html: !!caps.unfiltered_html, manage_options: !!caps.manage_options } }); }
    if (!d.dr) out.missing.push('The Dr. HVAC connector is not installed: existing pages and templates can be listed but their Elementor content cannot be read or edited. Download it from Dr. HVAC (Connector plugin), then Plugins, Add New, Upload, Activate.');
    if (!d.forge) out.missing.push('The FORGE bridge is not installed: new pages cannot be imported with Elementor data, SEO fields and JSON-LD. Download forge-bridge.zip from the Publish module and activate it.');
    if (d.dr || d.forge) { if (!out.elementor) out.warnings.push('Elementor is not active on this site: pages will be plain HTML sections.'); if (out.can && out.can.unfiltered_html === false) out.warnings.push('This user lacks unfiltered_html: Elementor data cannot be written. Use an administrator.'); if (out.permalinks === '') out.warnings.push('Permalinks are Plain: set Settings, Permalinks to Post name.'); }
    if (out.can && out.can.edit_pages === false) out.warnings.push('This user cannot edit pages: use an Editor or Administrator.');
    return out;
  }

  /* ---------- documents ---------- */
  const coreRow = (p, type) => ({ id: p.id, type, title: (p.title && (p.title.raw || p.title.rendered)) || '', slug: p.slug, status: p.status, link: p.link, modified: (p.modified_gmt || '').replace('T', ' '), template: p.template || 'default', builder: 'unknown', el_type: '', parent: p.parent || 0, seo: { title: '', description: '' } });
  /* list({type:'page'|'post'|'template'|'any', search, status, builder:'elementor'|'any', slug, page, per_page}) → {total, pages, items, via} */
  async function list(q, o) {
    q = q || {}; const d = await discover(o);
    if (d.dr) return Object.assign(await get(NS.dr + '/documents' + qs({ type: q.type || 'any', search: q.search, status: q.status, builder: q.builder, slug: q.slug, page: q.page, per_page: q.per_page || 50 }), o), { via: 'connector' });
    if (q.type === 'template') throw new WpError('Listing Elementor templates needs the Dr. HVAC connector.', { status: 0, code: 'no_connector', hint: 'Install the connector, or export the template from WordPress (Templates, Saved Templates, Export) and attach the file.' });
    const colls = q.type === 'post' ? ['posts'] : q.type === 'page' ? ['pages'] : ['pages', 'posts']; const items = []; let total = 0;
    for (const c of colls) { const r = await req('GET', `${NS.wp}/${c}` + qs({ search: q.search, slug: q.slug, status: q.status || 'any', per_page: Math.min(100, q.per_page || 50), page: q.page, context: 'edit', _fields: 'id,title,slug,status,link,modified_gmt,template,parent' }), undefined, o); (Array.isArray(r.json) ? r.json : []).forEach(p => items.push(coreRow(p, c === 'posts' ? 'post' : 'page'))); total += parseInt(r.headers['x-wp-total'] || '0', 10) || (Array.isArray(r.json) ? r.json.length : 0); }
    return { total, pages: 1, items, via: 'core', note: 'Read through WordPress core: the builder and the SEO fields are unknown without the Dr. HVAC connector.' };
  }
  /* an id, or a slug looked up first */
  async function resolve(idOrSlug, o) { if (/^\d+$/.test(String(idOrSlug))) return +idOrSlug; const r = await list({ slug: String(idOrSlug).replace(/^\/+|\/+$/g, '') }, o); if (!r.items.length) throw new WpError(`No page, post or template with the slug "${idOrSlug}" on the site.`, { status: 404, code: 'not_found' }); return r.items[0].id; }
  /* read(idOrSlug, {parts:'meta,elementor,content'}) → the connector's document, or the core fields with elementor: undefined and a note */
  async function read(idOrSlug, o) {
    o = o || {}; const d = await discover(o); const id = await resolve(idOrSlug, o);
    if (d.dr) return Object.assign(await get(`${NS.dr}/documents/${id}` + qs({ parts: o.parts }), o), { via: 'connector' });
    let p = null, type = 'page'; for (const c of ['pages', 'posts']) { try { p = await get(`${NS.wp}/${c}/${id}?context=edit`, o); type = c === 'posts' ? 'post' : 'page'; break; } catch (e) { if (e.status !== 404) throw e; } }
    if (!p) throw new WpError(`No page or post ${id} on the site.`, { status: 404, code: 'not_found' });
    return Object.assign(coreRow(p, type), { content: (p.content && (p.content.raw || p.content.rendered)) || '', excerpt: (p.excerpt && (p.excerpt.raw || '')) || '', via: 'core', note: 'Read through WordPress core. The Elementor tree of this page is not available without the Dr. HVAC connector; the content field is the plain HTML fallback, not the design.' });
  }
  /* write(id, {elementor_data, page_settings, title, slug, status, content_html, excerpt, seo, template, note, expect_modified}) */
  async function write(id, patch, o) { await needConnector('Editing an existing page', o); return post(`${NS.dr}/documents/${+id}`, patch || {}, o); }
  /* create({type, title, slug, status, clone_of, elementor_data, page_settings, content_html, template, template_type, seo}) */
  async function create(body, o) { await needConnector('Creating or cloning a document', o); return post(`${NS.dr}/documents`, body || {}, o); }
  async function backups(id, o) { await needConnector('Listing backups', o); return get(`${NS.dr}/documents/${+id}/backups`, o); }
  async function restore(id, backupId, o) { await needConnector('Restoring a backup', o); return post(`${NS.dr}/documents/${+id}/restore`, { backup_id: +backupId }, o); }
  async function kit(o) { await needConnector('Reading the Elementor kit', o); return get(NS.dr + '/kit', o); }
  async function menus(o) { await needConnector('Reading the menus', o); return get(NS.dr + '/menus', o); }
  async function inventory(o) { o = o || {}; await needConnector('The move inventory', o); return get(NS.dr + '/inventory' + qs({ deep: o.deep ? 1 : undefined }), o); }
  async function clearCache(o) { await needConnector('Clearing caches', o); return post(NS.dr + '/cache/clear', {}, o); }

  /* ---------- the bridge and core ---------- */
  async function media(query, kind, o) {
    const d = await discover(o); const want = kind === 'video' ? 'video' : (kind ? 'image' : '');
    if (d.forge) { const rows = await get(NS.forge + '/media/find' + qs({ q: query, per_page: 8 }), o); return (Array.isArray(rows) ? rows : []).filter(r => !want || !r.mime || String(r.mime).startsWith(want)).map(r => ({ id: r.id, url: r.url, alt: r.alt || '', title: r.title || '', width: r.width || 0, height: r.height || 0, mime: r.mime || '' })); }
    const rows = await get(NS.wp + '/media' + qs({ search: query, per_page: 8, media_type: want || undefined, _fields: 'id,source_url,mime_type,alt_text,title,media_details' }), o);
    return (Array.isArray(rows) ? rows : []).map(r => ({ id: r.id, url: r.source_url, alt: r.alt_text || '', title: (r.title && r.title.rendered) || '', width: (r.media_details || {}).width || 0, height: (r.media_details || {}).height || 0, mime: r.mime_type || '' }));
  }
  async function liveUrls(o) {
    const d = await discover(o); if (d.forge) { const j = await get(NS.forge + '/urls', o); return Array.isArray(j.urls) ? j.urls : []; }
    const urls = [D.withScheme(d.home).replace(/\/+$/, '') + '/'];
    for (const c of ['pages', 'posts']) { for (let p = 1, total = 1; p <= total && p <= 20; p++) { const r = await req('GET', `${NS.wp}/${c}` + qs({ per_page: 100, page: p, _fields: 'link' }), undefined, o); const rows = Array.isArray(r.json) ? r.json : []; total = parseInt(r.headers['x-wp-totalpages'] || '', 10) || (rows.length >= 100 ? p + 1 : p); rows.forEach(x => { if (x && x.link) urls.push(x.link); }); } }
    return [...new Set(urls)];
  }
  /* importTemplate({title, content, page_settings, type}) → saved to the Elementor library through the bridge */
  async function importTemplate(t, o) { await needBridge('Saving a template to the library', o); return post(NS.forge + '/template', { title: t.title || 'Template', content: t.content || [], page_settings: t.page_settings || null, type: t.type || 'page' }, o); }
  /* importBundle(bundle) → create or update a page by slug through the bridge (a draft unless bundle.status says publish) */
  async function importBundle(bundle, o) { await needBridge('Importing a page', o); return post(NS.forge + '/import', bundle, o); }

  /* ---------- the connector plugin as a download ---------- */
  function connectorZipEntries() { const php = typeof DRHVAC_CONNECTOR_PHP !== 'undefined' ? DRHVAC_CONNECTOR_PHP : ''; if (!php) throw new WpError('The connector source is not loaded (src/dr/14_dr_connector_raw.js).', { status: 0, code: 'no_source' }); return [{ name: 'drhvac-connector/drhvac-connector.php', data: php }]; }

  return { NS, CONNECTOR_VERSION, WpError, use, cfg, configured, site, url, discover, status, list, resolve, read, write, create, backups, restore, kit, menus, inventory, clearCache, media, liveUrls, importTemplate, importBundle, connectorZipEntries, hintFor, reset() { FOUND.clear(); } };
})();
