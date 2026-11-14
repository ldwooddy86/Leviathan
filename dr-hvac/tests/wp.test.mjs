/* src/dr/12_dr_wp.js against a mocked site: sign in, discovery, status with both plugins, one or none, the list and read
   fall backs, writes, backups, the bridge calls, error hints, and the embedded plugin source staying in step with the PHP. */
import fs from 'node:fs';
import path from 'node:path';
import { makeContext, load, suite, mockFetch, ROOT } from './lib/load.mjs';
import { rawScript } from '../tools/connector.mjs';
const { ok, eq, throwsAsync, done } = suite();

function site(o = {}) {
  const log = []; const ns = ['wp/v2'].concat(o.dr ? ['drhvac/v1'] : [], o.forge ? ['forge/v1'] : []);
  const J = (json, status = 200, headers = {}) => ({ status, json, headers });
  const noRoute = () => J({ code: 'rest_no_route', message: 'No route was found matching the URL and request method.', data: { status: 404 } }, 404);
  const routes = [
    [u => !/northside-comfort\.test/.test(u), () => { throw new TypeError('fetch failed'); }],      /* any other host is unreachable */
    [u => /\/wp-json\/$/.test(u), () => (o.html ? { status: 200, body: '<html>Checking your browser</html>', headers: { 'content-type': 'text/html' } } : J({ name: 'Northside Comfort', home: 'https://www.northside-comfort.test', namespaces: ns }))],
    [/drhvac\/v1\/status/, () => (o.dr ? J({ connector: o.drVer || '1.0.0', wp: '6.8.2', php: '8.2.20', theme: { name: 'Hello Elementor', child: true }, elementor: '3.32.0', elementor_pro: null, containers: true, kit_id: 12, permalinks: '/%postname%/', seo_plugin: 'rankmath', multisite: false, user: 'webdev', can: { edit_pages: true, publish_pages: true, unfiltered_html: o.caps !== false, manage_options: true }, counts: { pages: 31, posts: 12, templates: 4, media: 208 } }) : noRoute())],
    [/forge\/v1\/status/, () => (o.forge ? J({ forge: '1.1.0', wp: '6.8.2', php: '8.2.20', elementor: '3.32.0', containers: true, theme: 'Hello Elementor', permalinks: '/%postname%/', seo_plugin: 'rankmath', unfiltered_html: true, user: 'webdev' }) : noRoute())],
    [/wp\/v2\/users\/me/, () => (o.badAuth ? J({ code: 'incorrect_password', message: 'The provided password is an invalid application password.' }, 401) : J({ slug: 'webdev', capabilities: { edit_pages: true, publish_pages: true } }))],
    [/drhvac\/v1\/documents\/7\/backups/, () => J([{ backup_id: 90, at: '2026-11-14 10:00:00', by: 'webdev', note: 'Headline change', bytes: 2048 }])],
    [/drhvac\/v1\/documents\/7\/restore/, (u, i) => J({ id: 7, restored_from: JSON.parse(i.body).backup_id, backup_id: 91 })],
    [(u, i) => /drhvac\/v1\/documents\/7(\?|$)/.test(u) && (i.method || 'GET') === 'POST', (u, i) => { const b = JSON.parse(i.body); if (b.expect_modified === 'old') return J({ code: 'drhvac_stale', message: 'This document changed on the site after it was read.', data: { status: 409 } }, 409); if (o.caps === false && b.elementor_data) return J({ code: 'drhvac_caps', message: 'Writing Elementor data needs the unfiltered_html capability.' }, 403); return J({ id: 7, status: 'draft', backup_id: 90, changed: Object.keys(b).filter(k => k !== 'expect_modified' && k !== 'note'), modified: '2026-11-14 10:05:00' }); }],
    [/drhvac\/v1\/documents\/7(\?|$)/, u => J({ id: 7, type: 'page', title: 'AC Repair Frisco', slug: 'lp-ac-frisco', status: 'publish', modified: '2026-11-14 09:00:00', builder: 'elementor', elementor: /parts=meta/.test(u) ? undefined : { data: [{ id: 'a', elType: 'container', settings: {}, elements: [] }], page_settings: {} }, seo: { title: 'AC Repair in Frisco', description: '', canonical: '', noindex: false } })],
    [(u, i) => /drhvac\/v1\/documents(\?|$)/.test(u) && (i.method || 'GET') === 'POST', (u, i) => J({ id: 55, type: JSON.parse(i.body).type || 'page', status: 'draft', link: 'https://www.northside-comfort.test/?page_id=55', cloned_from: JSON.parse(i.body).clone_of || null })],
    [/drhvac\/v1\/documents\?/, u => J(/slug=missing/.test(u) ? { total: 0, pages: 0, items: [] } : { total: 2, pages: 1, items: [{ id: 7, type: 'page', title: 'AC Repair Frisco', slug: 'lp-ac-frisco', status: 'publish', builder: 'elementor' }, { id: 9, type: 'template', title: 'Landing template', slug: 'landing-template', status: 'publish', builder: 'elementor', el_type: 'page' }] })],
    [/drhvac\/v1\/kit/, () => J({ kit_id: 12, system_colors: [{ _id: 'primary', title: 'Primary', color: '#173A69' }] })],
    [/drhvac\/v1\/menus/, () => J([{ id: 5, name: 'Main', locations: ['primary'], items: [] }])],
    [/drhvac\/v1\/inventory/, u => J({ wp: '6.8.2', db: { size_bytes: 48234496 }, url_rows: /deep=1/.test(u) ? { options: 14 } : undefined })],
    [/drhvac\/v1\/cache\/clear/, () => J({ cleared: ['Elementor CSS'] })],
    [/forge\/v1\/media\/find/, () => J([{ id: 3, url: 'https://www.northside-comfort.test/wp-content/uploads/crew.webp', alt: 'Crew', mime: 'image/webp', width: 1600, height: 1000 }, { id: 4, url: 'https://www.northside-comfort.test/wp-content/uploads/tour.mp4', mime: 'video/mp4' }])],
    [/forge\/v1\/urls/, () => J({ count: 2, urls: ['https://www.northside-comfort.test/', 'https://www.northside-comfort.test/ac-repair/'] })],
    [/forge\/v1\/template/, (u, i) => J({ id: 77, edit: 'https://www.northside-comfort.test/wp-admin/post.php?post=77&action=elementor', got: JSON.parse(i.body).title })],
    [/forge\/v1\/import/, (u, i) => J({ id: 88, slug: JSON.parse(i.body).slug, status: JSON.parse(i.body).status, link: 'https://www.northside-comfort.test/lp/', updated: false })],
    [/wp\/v2\/pages\/7/, () => J({ id: 7, title: { raw: 'AC Repair Frisco' }, slug: 'lp-ac-frisco', status: 'publish', link: 'https://www.northside-comfort.test/lp-ac-frisco/', modified_gmt: '2026-11-14T09:00:00', content: { raw: '<p>Fallback</p>' }, excerpt: { raw: '' } })],
    [/wp\/v2\/posts\/7/, () => noRoute()],
    [/wp\/v2\/pages\?/, u => J(/page=2/.test(u) ? [] : [{ id: 7, title: { raw: 'AC Repair Frisco' }, slug: 'lp-ac-frisco', status: 'publish', link: 'https://www.northside-comfort.test/lp-ac-frisco/', modified_gmt: '2026-11-14T09:00:00' }], 200, { 'x-wp-total': '1', 'x-wp-totalpages': '1' })],
    [/wp\/v2\/posts\?/, () => J([{ id: 20, title: { rendered: 'Furnace guide' }, slug: 'furnace-guide', status: 'publish', link: 'https://www.northside-comfort.test/furnace-guide/', modified_gmt: '2026-11-01T09:00:00' }], 200, { 'x-wp-total': '1', 'x-wp-totalpages': '1' })],
    [/wp\/v2\/media\?/, () => J([{ id: 3, source_url: 'https://www.northside-comfort.test/wp-content/uploads/crew.webp', alt_text: 'Crew', mime_type: 'image/webp', title: { rendered: 'crew' }, media_details: { width: 1600, height: 1000 } }])],
  ];
  const ctx = makeContext({ fetch: mockFetch(routes, log) });
  load(ctx, ['dr/00_dr_core.js', 'dr/14_dr_connector_raw.js', 'dr/12_dr_wp.js']);
  const W = ctx.DRHVAC.wp; W.use({ url: 'www.northside-comfort.test/', user: ' webdev ', appPass: 'abcd efgh ijkl mnop' });
  return { W, log, ctx };
}

/* ---- sign in and urls ---- */
{
  const { W, log } = site({ dr: true, forge: true });
  ok(W.configured() && W.site() === 'https://www.northside-comfort.test' && W.url('drhvac/v1/status') === 'https://www.northside-comfort.test/wp-json/drhvac/v1/status', 'a pasted host gets https and no trailing slash');
  const s = await W.status();
  ok(log[0].headers.Authorization === 'Basic ' + Buffer.from('webdev:abcd efgh ijkl mnop').toString('base64') && log.every(l => l.url.startsWith('https://www.northside-comfort.test/wp-json/')), 'Basic auth with the trimmed username and the Application Password');
  ok(s.ok && s.name === 'Northside Comfort' && s.connector.on && s.connector.current && s.connector.version === '1.0.0' && s.bridge.on && s.bridge.version === '1.1.0' && s.elementor === '3.32.0' && s.containers && s.theme === 'Hello Elementor' && s.seo === 'rankmath' && s.user === 'webdev' && s.counts.templates === 4 && !s.missing.length && !s.warnings.length, 'status with both plugins: versions, Elementor, theme, SEO plugin, counts, nothing missing', JSON.stringify(s.warnings));
  /* documents through the connector */
  const l = await W.list({ type: 'any', search: 'ac' }); ok(l.via === 'connector' && l.total === 2 && l.items[1].type === 'template' && /type=any&search=ac&per_page=50/.test(log[log.length - 1].url), 'list goes to the connector with the filters');
  const d = await W.read(7); ok(d.via === 'connector' && d.elementor.data[0].elType === 'container' && d.seo.title === 'AC Repair in Frisco', 'read returns the Elementor tree');
  ok((await W.read('lp-ac-frisco', { parts: 'meta' })).id === 7 && /documents\?type=any&slug=lp-ac-frisco/.test(log[log.length - 2].url) && /documents\/7\?parts=meta/.test(log[log.length - 1].url), 'a slug is looked up first, then read by id');
  ok(await throwsAsync(() => W.read('missing'), /No page, post or template with the slug "missing"/), 'an unknown slug says so');
  const w = await W.write(7, { elementor_data: [], seo: { title: 'x' }, expect_modified: '2026-11-14 09:00:00', note: 'n' }); const sent = JSON.parse(log[log.length - 1].body);
  ok(w.backup_id === 90 && w.changed.join() === 'elementor_data,seo' && log[log.length - 1].method === 'POST' && sent.expect_modified === '2026-11-14 09:00:00' && log[log.length - 1].headers['Content-Type'] === 'application/json', 'write posts the patch with the staleness stamp and returns the backup id');
  let e = null; try { await W.write(7, { title: 'late', expect_modified: 'old' }); } catch (x) { e = x; }
  ok(e && e.name === 'WpError' && e.status === 409 && e.code === 'drhvac_stale' && /^409 This document changed/.test(e.message) && /Read it again/.test(e.hint), 'a stale write is a 409 with the site\'s message and a hint');
  eq([(await W.create({ clone_of: 7, title: 'Copy' })).cloned_from, (await W.backups(7))[0].note, (await W.restore(7, 90)).restored_from, (await W.kit()).system_colors[0].color, (await W.menus())[0].name, (await W.clearCache()).cleared[0]], [7, 'Headline change', 90, '#173A69', 'Main', 'Elementor CSS'], 'create or clone, backups, restore, kit, menus and cache clearing');
  ok((await W.inventory()).db.size_bytes === 48234496 && (await W.inventory({ deep: true })).url_rows.options === 14 && /inventory\?deep=1$/.test(log[log.length - 1].url), 'inventory, and the deep scan only when asked');
  /* the bridge */
  const m = await W.media('crew', 'image'); ok(m.length === 1 && m[0].id === 3 && m[0].width === 1600, 'media search through the bridge, filtered to images');
  eq([(await W.liveUrls()).length, (await W.importTemplate({ title: 'T', content: [] })).got, (await W.importBundle({ slug: 'lp', status: 'draft' })).id], [2, 'T', 88], 'live urls, template import and bundle import through the bridge');
  const n = log.filter(l => /\/wp-json\/$/.test(l.url)).length; ok(n === 1, 'the site is discovered once and remembered (status always asks again)', n);
}
/* ---- an old connector, and a user without unfiltered_html ---- */
{
  const { W } = site({ dr: true, forge: true, drVer: '0.9.0', caps: false }); const s = await W.status();
  ok(!s.connector.current && s.warnings.some(w => /connector on the site is 0\.9\.0; this build ships 1\.0\.0/.test(w)) && s.warnings.some(w => /lacks unfiltered_html/.test(w)), 'an out of date connector and a missing capability are warnings');
  let e = null; try { await W.write(7, { elementor_data: [] }); } catch (x) { e = x; }
  ok(e && e.status === 403 && e.code === 'drhvac_caps' && /administrator/.test(e.hint), 'a capability refusal carries the hint to use an administrator');
}
/* ---- bridge only ---- */
{
  const { W } = site({ forge: true }); const s = await W.status();
  ok(!s.connector.on && s.bridge.on && s.elementor === '3.32.0' && s.missing.length === 1 && /connector is not installed/.test(s.missing[0]), 'with only the bridge, status still reads Elementor and names the missing connector');
  const l = await W.list({ type: 'any' }); ok(l.via === 'core' && l.items.length === 2 && l.items[0].builder === 'unknown' && l.items[1].title === 'Furnace guide' && /without the Dr\. HVAC connector/.test(l.note), 'list falls back to WordPress core and says what it cannot know');
  const d = await W.read(7); ok(d.via === 'core' && d.elementor === undefined && d.content === '<p>Fallback</p>' && /not available without the Dr\. HVAC connector/.test(d.note), 'read falls back to core: no Elementor tree, and it says so');
  let e = null; try { await W.write(7, { title: 'x' }); } catch (x) { e = x; }
  ok(e && e.code === 'no_connector' && /needs the Dr\. HVAC connector on Northside Comfort/.test(e.message) && /Plugins, Add New, Upload, Activate/.test(e.hint), 'a write without the connector explains how to install it');
  ok(await throwsAsync(() => W.list({ type: 'template' }), /needs the Dr\. HVAC connector/) && await throwsAsync(() => W.kit(), /needs the Dr\. HVAC connector/), 'templates and the kit need the connector');
}
/* ---- neither plugin ---- */
{
  const { W } = site({}); const s = await W.status();
  ok(s.ok && s.user === 'webdev' && s.can.edit_pages && s.missing.length === 2 && s.elementor === null, 'with neither plugin the core user check still answers and both gaps are listed');
  ok((await W.media('crew', 'image'))[0].url.endsWith('crew.webp') && (await W.liveUrls()).join() === 'https://www.northside-comfort.test/,https://www.northside-comfort.test/lp-ac-frisco/,https://www.northside-comfort.test/furnace-guide/', 'media and live urls fall back to core');
  let e = null; try { await W.importBundle({ slug: 'x' }); } catch (x) { e = x; }
  ok(e && e.code === 'no_bridge' && /forge-bridge\.zip/.test(e.hint), 'an import without the bridge explains how to install it');
}
/* ---- failures ---- */
{
  const { W } = site({ badAuth: true }); let e = null; try { await W.status(); } catch (x) { e = x; }
  ok(e && e.status === 401 && /invalid application password/.test(e.message) && /Application Password/.test(e.hint), 'a 401 carries the site\'s message and where to fix the password');
  const h = site({ html: true }).W; ok(await throwsAsync(() => h.status(), /not with JSON. A cache or a security page/), 'an HTML answer (a challenge page) is named for what it is');
  const off = site({}).W; off.use({ url: 'https://unreachable.test', user: 'u', appPass: 'p' }); ok(await throwsAsync(() => off.status(), /Could not reach unreachable\.test/), 'an unreachable site says so');
  const none = site({}).W; none.use(null); ok(!none.configured() && await throwsAsync(() => none.status(), /No WordPress site is connected/), 'with no credentials nothing is sent');
  ok(/Post name/.test(W.hintFor(404, 'rest_no_route', 'wp/v2/pages')) && /connector is not active/.test(W.hintFor(404, 'rest_no_route', 'drhvac/v1/status')) && /rate limited/.test(W.hintFor(429, '', 'x')) && W.hintFor(418, '', 'x') === '', 'hints are specific to the route and the status');
}
/* ---- credentials from the Publish module's card ---- */
{
  const ctx = makeContext({ fetch: mockFetch([]), globals: { CMS: { cfg: id => (id === 'wp_headless' ? { url: 'https://cms.northside-comfort.test', user: 'a', appPass: 'b' } : {}) } } });
  load(ctx, ['dr/00_dr_core.js', 'dr/12_dr_wp.js']);
  ok(ctx.DRHVAC.wp.configured() && ctx.DRHVAC.wp.site() === 'https://cms.northside-comfort.test', 'the sign in comes from the Publish module\'s WordPress card, the headless one when the Elementor card is empty');
}
/* ---- the embedded plugin ---- */
{
  const { W, ctx } = site({}); const php = fs.readFileSync(path.join(ROOT, 'src/connector/drhvac-connector.php'), 'utf8');
  ok(fs.readFileSync(path.join(ROOT, 'src/dr/14_dr_connector_raw.js'), 'utf8') === rawScript(php), 'src/dr/14_dr_connector_raw.js is exactly what tools/connector.mjs writes from the PHP file');
  const z = W.connectorZipEntries(); ok(z.length === 1 && z[0].name === 'drhvac-connector/drhvac-connector.php' && z[0].data === php && ctx.DRHVAC_CONNECTOR_PHP === php, 'the zip entry is the plugin, byte for byte');
  ok(new RegExp(`const VER\\s+= '${W.CONNECTOR_VERSION}'`).test(php) && /Version: 1\.0\.0/.test(php), 'the client and the plugin agree on the version');
  ok(!/<\/script/i.test(fs.readFileSync(path.join(ROOT, 'src/dr/14_dr_connector_raw.js'), 'utf8')), 'the embedded source can sit inside an inline script');
}
done();
