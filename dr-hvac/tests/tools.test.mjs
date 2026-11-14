/* src/dr/20_dr_tools.js and 21_dr_tools_work.js without the dashboard: the registry, every schema, the workshop (pages,
   documents, files), the Elementor tools end to end, the WordPress and hosting tools against mocked sites, and each tool
   that needs a part of the dashboard saying so in plain words. The tools that read the atlas itself (atlas_*, forge_*,
   blueprint pages, publish) are exercised in the real page by tests/e2e/run.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { makeContext, load, suite, mockFetch, SRC } from './lib/load.mjs';
const { ok, eq, throwsAsync, done } = suite();

const FILES = ['dr/00_dr_core.js', 'dr/01_dr_knowledge.js', 'dr/02_dr_llm.js', 'dr/03_dr_agent.js', 'dr/10_dr_html.js', 'dr/11_dr_elementor.js', 'dr/12_dr_wp.js', 'dr/13_dr_hosting.js', 'dr/14_dr_connector_raw.js', 'dr/20_dr_tools.js', 'dr/21_dr_tools_work.js'].filter(f => fs.existsSync(path.join(SRC, f)));
const J = (json, status = 200, headers = {}) => ({ status, json, headers });
const TREE = [{ id: 'aaa0001', elType: 'container', settings: { flex_direction: 'column', html_tag: 'section' }, elements: [{ id: 'aaa0002', elType: 'widget', widgetType: 'heading', settings: { title: 'AC Repair in Plano, TX', header_size: 'h1' }, elements: [] }, { id: 'aaa0003', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Call (972) 555 0100 for Plano AC repair.</p>' }, elements: [] }, { id: 'aaa0004', elType: 'widget', widgetType: 'image', settings: { image: { url: 'https://old.example/a.webp', id: 44, alt: 'A technician' } }, elements: [] }, { id: 'aaa0005', elType: 'widget', widgetType: 'form', settings: { form_name: 'Lead', form_fields: [{ custom_id: 'name', field_label: 'Name', field_type: 'text', _id: 'f1' }], button_text: 'Send' }, elements: [] }], isInner: false }];
function boot(o = {}) {
  const log = []; let siteModified = '2026-11-14 09:00:00'; const writes = [];
  const routes = [
    [u => /\/wp-json\/$/.test(u), () => J({ name: 'Northside Comfort', home: 'https://www.northside-comfort.test', namespaces: ['wp/v2', 'drhvac/v1', 'forge/v1'] })],
    [/drhvac\/v1\/status/, () => J({ connector: '1.0.0', wp: '6.8.2', elementor: '3.32.0', containers: true, theme: { name: 'Hello Elementor' }, seo_plugin: 'yoast', user: 'webdev', can: { edit_pages: true, unfiltered_html: true }, counts: { pages: 3, templates: 1 }, permalinks: '/%postname%/' })],
    [/forge\/v1\/status/, () => J({ forge: '1.1.0' })],
    [(u, i) => /drhvac\/v1\/documents\/7(\?|$)/.test(u) && (i.method || 'GET') === 'POST', (u, i) => { const b = JSON.parse(i.body); writes.push(b); if (b.expect_modified && b.expect_modified !== siteModified) return J({ code: 'drhvac_stale', message: 'This document changed on the site after it was read.' }, 409); siteModified = '2026-11-14 10:00:00'; return J({ id: 7, status: o.status || 'draft', backup_id: 90, changed: Object.keys(b).filter(k => !['expect_modified', 'note'].includes(k)), modified: siteModified }); }],
    [/drhvac\/v1\/documents\/7\/backups/, () => J([{ backup_id: 90, at: '2026-11-14 10:00:00', by: 'webdev', note: 'x', bytes: 10 }])],
    [/drhvac\/v1\/documents\/7\/restore/, () => J({ id: 7, restored_from: 90, backup_id: 91 })],
    [/drhvac\/v1\/documents\/7(\?|$)/, u => J({ id: 7, type: 'page', title: 'AC Repair Plano', slug: 'lp-ac-plano', status: o.status || 'draft', link: 'https://www.northside-comfort.test/lp-ac-plano/', modified: siteModified, builder: 'elementor', template: 'elementor_canvas', backups: 0, seo: { title: 'AC Repair in Plano', description: '', noindex: true }, elementor: /parts=meta/.test(u) ? undefined : { version: '3.32.0', data: TREE, page_settings: { hide_title: 'yes' } } })],
    [/drhvac\/v1\/documents\/8(\?|$)/, () => J({ id: 8, type: 'page', title: 'About', slug: 'about', status: 'publish', builder: 'classic', elementor: null, content: '<p>About us</p>' })],
    [(u, i) => /drhvac\/v1\/documents(\?|$)/.test(u) && (i.method || 'GET') === 'POST', (u, i) => J({ id: 55, type: 'page', status: 'draft', link: 'https://www.northside-comfort.test/?page_id=55', sent: JSON.parse(i.body) })],
    [/drhvac\/v1\/documents\?/, () => J({ total: 1, pages: 1, items: [{ id: 7, type: 'page', title: 'AC Repair Plano', slug: 'lp-ac-plano', status: o.status || 'draft', builder: 'elementor' }] })],
    [/drhvac\/v1\/kit/, () => J({ kit_id: 12, system_colors: [{ _id: 'primary', color: '#173A69' }] })],
    [/drhvac\/v1\/inventory/, () => J({ wp: '6.8.2', db: { size_bytes: 48234496 }, plugins: [] })],
    [/drhvac\/v1\/cache\/clear/, () => J({ cleared: ['Elementor CSS'] })],
    [/forge\/v1\/media\/find/, () => J([{ id: 3, url: 'https://www.northside-comfort.test/wp-content/uploads/crew.webp', alt: 'Crew', mime: 'image/webp' }])],
    [/forge\/v1\/urls/, () => J({ urls: ['https://www.northside-comfort.test/', 'https://www.northside-comfort.test/ac-repair/'] })],
    [/forge\/v1\/template/, (u, i) => J({ id: 77, edit: 'https://www.northside-comfort.test/wp-admin/post.php?post=77', title: JSON.parse(i.body).title })],
    [/^https:\/\/public\.test\/page$/, () => ({ status: 200, headers: { 'content-type': 'text/html', server: 'nginx', 'x-powered-by': 'PHP/8.2' }, body: '<!doctype html><html lang="en"><head><title>Furnace Repair Frisco | Northside Comfort</title><meta name="description" content="Furnace repair for Frisco homes."><link rel="canonical" href="https://public.test/page"></head><body><main><h1>Furnace Repair in Frisco</h1><p>Call <a href="tel:+19725550100">(972) 555 0100</a>. ' + 'word '.repeat(60) + '</p></main></body></html>' })],
    ['https://public.test/sitemap.xml', () => ({ status: 200, body: '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://public.test/page-sitemap.xml</loc></sitemap></sitemapindex>' })],
    ['https://public.test/page-sitemap.xml', () => ({ status: 200, body: '<urlset><url><loc>https://public.test/</loc></url><url><loc>https://public.test/ac-repair/</loc></url></urlset>' })],
  ];
  const ctx = makeContext({ fetch: mockFetch(routes, log), globals: o.globals || {} });
  load(ctx, FILES); const D = ctx.DRHVAC; D.wp.use({ url: 'https://www.northside-comfort.test', user: 'webdev', appPass: 'x' });
  const asks = []; const ctxOf = () => ({ signal: new AbortController().signal, progress: () => { }, ask: async a => { asks.push(a); return o.answer !== undefined ? o.answer : true; } });
  const run = (name, input) => D.tools.get(name).run(input || {}, ctxOf());
  return { D, ctx, log, run, asks, writes, T: D.tools };
}

/* ============ the registry ============ */
{
  const { D, T } = boot(); const list = T.list(); const names = list.map(t => t.name);
  ok(list.length >= 48 && new Set(names).size === names.length && names.every(n => /^[a-z][a-z0-9_]{2,40}$/.test(n)), `${list.length} tools with unique snake case names`);
  const walk = (s, at, bad) => { if (!s || typeof s !== 'object') return bad.push(at + ' not a schema'); if (!s.type) bad.push(at + ' has no type'); if (s.type === 'object' && s.properties) Object.entries(s.properties).forEach(([k, v]) => walk(v, at + '.' + k, bad)); if (s.type === 'array') { if (!s.items) bad.push(at + ' has no items'); else walk(s.items, at + '[]', bad); } return bad; };
  const bad = []; list.forEach(t => { walk(t.input_schema, t.name, bad); if (t.input_schema.additionalProperties !== false) bad.push(t.name + ' allows extra fields'); (t.input_schema.required || []).forEach(k => { if (!t.input_schema.properties[k]) bad.push(t.name + ' requires unknown ' + k); }); Object.entries(t.input_schema.properties).forEach(([k, v]) => { if (!v.description && v.type !== 'object') bad.push(`${t.name}.${k} has no description`); }); });
  ok(!bad.length, 'every input schema is a closed object whose fields have a type and a description', bad.slice(0, 5).join(' | '));
  ok(list.every(t => t.description.length >= 80 && t.description.length <= 1400 && typeof t.run === 'function' && (typeof t.risk === 'function' || ['read', 'local', 'settings', 'draft', 'live'].includes(t.risk))), 'every tool says when to use it, runs, and declares its risk');
  eq(list.filter(t => t.risk === 'settings').map(t => t.name), ['brand_update', 'forge_set'], 'the two tools that change what the person saved in the atlas always ask');
  { const c = T.get('forge_set').confirm({ site: { cta_label: 'Schedule service' }, focus: { picks: ['Frisco', 'Plano'] } }); ok(/module 09/.test(c.title) && /site\.cta_label → Schedule service/.test(c.detail) && /focus\.picks → \["Frisco","Plano"\]/.test(c.detail), 'and the card lists each change in words', c.detail); }
  eq(list.filter(t => t.risk === 'live').map(t => t.name), ['wp_restore'], 'one tool is always a live change; the others decide from their input');
  eq(list.filter(t => typeof t.risk === 'function').map(t => t.name).sort(), ['elementor_export', 'page_publish', 'sitemap_read', 'wp_site', 'wp_write'], 'five tools take their risk from the input');
  const net = list.filter(t => t.viewer === false).map(t => t.name); ok(['wp_status', 'wp_write', 'fetch_url', 'dns_lookup', 'migration_verify'].every(n => net.includes(n)) && !net.includes('page_create') && !net.includes('migration_plan') && !net.includes('elementor_edit'), 'the tools that need the network are marked, so the viewer is not offered them');
  const defs = T.defs(); ok(defs.length === list.length && defs.every(d => Object.keys(d).join() === 'name,description,input_schema') && JSON.stringify(defs) === JSON.stringify(T.defs()), 'defs() is the stable list the conversation freezes: name, description, schema, nothing else');
  ok(D.validate(T.get('page_create').input_schema, { page: { slug: 'x', title: 'y' }, sections: [{ type: 'hero' }] }).length === 0 && D.validate(T.get('page_create').input_schema, { sections: 'no' }).length === 2, 'the schema check accepts a fitting input and names a misfit');
  ok(D.knowledge.system().length > 8000 && !/\b(202\d-\d\d-\d\d)\b/.test(D.knowledge.system()) && /Drafts first/.test(D.knowledge.system()) && /FORGE blueprint/.test(D.knowledge.system()), 'the system prompt carries the rules and the page format, and no date or other moving state');
  const tc = D.knowledge.turnContext({ module: 'Site Forge' }); ok(/^Date: \d{4}-\d\d-\d\d \(\w+day\)/.test(tc) && /Atlas running as: the test harness/.test(tc) && /Module on screen before Dr. HVAC: Site Forge/.test(tc) && /Workshop: 0 pages, 0 Elementor documents, 0 files/.test(tc), 'the per turn state block has the date, where it runs, the module and the workshop', tc);
}

/* ============ files ============ */
{
  const { run, T } = boot();
  const f = await run('file_write', { name: 'launch/check:list.md', content: '# Launch\n- DNS', note: 'Checklist' });
  ok(f.name === 'launch-check-list.md' && f.size === 14 && T.WS.files[f.id].mime === 'text/markdown', 'file_write saves a text deliverable with a safe name and a type from its extension');
  const big = T.addFile({ name: 'big.txt', text: 'x'.repeat(50000), kind: 'attachment' });
  const r1 = await run('file_read', { id: big.id, max: 1000 }); ok(r1.text.length === 1000 && r1.total === 50000 && r1.more === 'call again with offset 1000' && (await run('file_read', { id: big.id, offset: 49500 })).more === undefined, 'file_read slices a long file and says how to get the rest');
  const img = T.addFile({ name: 'hero.webp', blob: new Blob([new Uint8Array(2048)], { type: 'image/webp' }), mime: 'image/webp', kind: 'attachment' });
  ok(await throwsAsync(() => run('file_read', { id: img.id }), /is not a text file/) && T.fileBlob(img.id).size === 2048 && T.WS.files[img.id].binary === true, 'a binary attachment is kept as a blob and file_read says it is not text');
  eq((await run('file_list')).files.map(x => [x.name, x.kind, x.text]), [['launch-check-list.md', 'deliverable', true], ['big.txt', 'attachment', true], ['hero.webp', 'attachment', false]], 'file_list shows attachments and deliverables');
  ok(await throwsAsync(() => run('file_read', { id: 'nope' }), /No file "nope"/), 'an unknown file id says so');
}

/* ============ an Elementor template, start to finish ============ */
{
  const { run, T, D } = boot();
  const f = T.addFile({ name: 'landing-template.json', text: JSON.stringify({ content: TREE, page_settings: { template: 'elementor_canvas' }, version: '0.4', title: 'Landing', type: 'page' }), kind: 'attachment', mime: 'application/json' });
  const L = await run('elementor_load', { source: 'file', file_id: f.id });
  ok(L.valid && L.name === 'landing-template' && L.stats.widgets === 4 && L.needs.elementor_pro.join() === 'form' && /\[aaa0001\] container/.test(L.outline) && L.source === 'file landing-template.json', 'elementor_load reads an attached export: valid, counted, Pro widgets named, outline shown', JSON.stringify(L.stats));
  ok(await throwsAsync(() => run('elementor_load', { source: 'json', json: '{"hello":1}' }), /not an Elementor document/) && await throwsAsync(() => run('elementor_load', { source: 'file', file_id: 'zz' }), /No file/), 'something that is not a template is refused');
  const S = await run('elementor_slots', { doc: L.doc }); ok(S.total === 6 && S.slots[0].ref === 'aaa0002.title' && S.slots.find(s => s.kind === 'image').value.id === 44 && (await run('elementor_slots', { doc: L.doc, kinds: ['text'], limit: 1 })).more === 'call again with offset 1', 'elementor_slots lists every slot with its reference, and pages', S.slots.map(s => s.ref).join(','));
  ok(/\[aaa0002\] heading \(h1\) "AC Repair in Plano, TX"/.test(await run('elementor_outline', { doc: L.doc })) && (await run('elementor_outline', { doc: L.doc, el: 'aaa0005' })).startsWith('[aaa0005] form') && await throwsAsync(() => run('elementor_outline', { doc: L.doc, el: 'zzz' }), /No element zzz/), 'elementor_outline shows the tree or one element');
  const Ed = await run('elementor_edit', { doc: L.doc, ops: [{ op: 'set', ref: 'aaa0002.title', value: 'Furnace Repair in Frisco, TX' }, { op: 'replace_text', find: 'Plano', replace: 'Frisco' }, { op: 'set', ref: 'nope.title', value: 'x' }, { op: 'insert_section', parent: 'root', section: { type: 'faq', items: [{ q: 'Q', a: 'A' }] } }] });
  ok(Ed.changed === 2 && /0: set ok/.test(Ed.log[0]) && /2: set FAILED: no element nope/.test(Ed.log[2]) && Ed.log.some(l => /insert_section: the Site Forge compiler is not loaded/.test(l)) && Ed.valid && /Changed heading aaa0002/.test(Ed.what_changed), 'elementor_edit applies what it can and reports each op; a compiled section needs the dashboard and says so', Ed.log.join(' | '));
  ok(T.WS.docs[L.doc].elements[0].elements[1].settings.editor.includes('Frisco AC repair'), 'the document in the workshop carries the edit');
  const U = await run('elementor_undo', { doc: L.doc }); ok(U.undone && U.steps_left === 0 && T.WS.docs[L.doc].elements[0].elements[0].settings.title === 'AC Repair in Plano, TX' && await throwsAsync(() => run('elementor_undo', { doc: L.doc }), /Nothing to undo/), 'elementor_undo steps back, once per edit');
  await run('elementor_edit', { doc: L.doc, ops: [{ op: 'replace_text', find: 'Plano', replace: 'Frisco' }] });
  const P = await run('elementor_to_page', { doc: L.doc, page: { slug: 'LP Furnace Frisco', title: 'Furnace Repair in Frisco | Northside Comfort', h1: 'Furnace Repair in Frisco, TX', meta_description: 'Furnace repair for Frisco homes from a licensed local crew. Written prices before work starts, same week visits, and a real person on the phone.', noindex: true } });
  ok(P.slug === 'lp-furnace-frisco' && P.kind === 'elementor' && P.image_ids_cleared === 1 && P.image_hosts.join() === 'old.example' && P.words > 5 && P.noindex === true && T.WS.current === P.id, 'elementor_to_page makes a workshop page: image ids cleared for a template from a file, the old image host reported', JSON.stringify({ c: P.checks, f: P.findings }));
  const pg = T.page(P.id); ok(pg.doc.elements[0].id !== 'aaa0001' && pg.doc.elements[0].elements[0].settings.title === 'AC Repair in Frisco, TX' && pg.doc.elements[0].elements[2].settings.image.id === '' && T.WS.docs[L.doc].elements[0].id === 'aaa0001', 'the page holds its own copy with fresh ids; the loaded document is untouched');
  const E2 = await run('elementor_edit', { doc: P.id, ops: [{ op: 'set', ref: pg.doc.elements[0].elements[0].id + '.title', value: 'Furnace Repair in Frisco, TX' }] }); ok(E2.changed === 1 && T.page(P.id).doc.elements[0].elements[0].settings.title === 'Furnace Repair in Frisco, TX', 'an Elementor page is edited by its page id');
  const G = await run('page_get', { id: P.id }); ok(G.kind === 'elementor' && G.template === 'elementor_canvas' && G.elementor.widgets === 4 && Array.isArray(G.findings), 'page_get summarizes an Elementor page');
  ok((await run('page_get', { id: 'lp-furnace-frisco', part: 'html' })).includes('<h1>Furnace Repair in Frisco, TX</h1>') && /heading \(h1\)/.test(await run('page_get', { id: P.id, part: 'elementor' })), 'its HTML fallback and its tree can be read by slug or id');
  const SC = await run('page_edit', { id: P.id, schema: { '@context': 'https://schema.org', '@type': 'HVACBusiness', name: 'Northside Comfort', telephone: '+19725550100' }, find_replace: [{ find: 'a', replace: 'b' }] });
  ok(SC.log.includes('schema: replaced') && SC.log.some(l => /elementor_edit/.test(l)) && T.page(P.id).schema['@type'] === 'HVACBusiness' && T.build(T.page(P.id)).preview.includes('application/ld+json') && T.build(T.page(P.id)).schema.name === 'Northside Comfort', 'an Elementor page takes its JSON-LD through page_edit and carries it in its build; its content still goes through elementor_edit', SC.log.join(' | '));
  const SR = await run('page_edit', { id: P.id, schema: null }); ok(SR.log.includes('schema: removed') && T.page(P.id).schema === null && !T.build(T.page(P.id)).preview.includes('application/ld+json'), 'and a null schema takes it off again');
  const AU = T.auditPage(T.page(P.id), T.build(T.page(P.id)));
  ok(AU.areas.perf.skipped === true && AU.areas.perf.score === null && !AU.findings.some(f => f.area === 'perf' && !f.info) && AU.findings.some(f => f.id === 'perf.not_scored' && f.info) && AU.skipped.includes('perf (not scored)'), 'speed is not scored for an Elementor page, which is audited on an approximate rendering, and the audit says so');
  const X = await run('page_export', { id: P.id, formats: ['preview', 'html', 'elementor', 'bundle', 'blueprint', 'schema'] });
  eq([X.files.map(x => x.name), X.skipped.length], [['lp-furnace-frisco.preview.html', 'lp-furnace-frisco.content.html', 'lp-furnace-frisco.elementor-template.json', 'lp-furnace-frisco.bundle.json'], 2], 'page_export writes the preview, the markup, the template file and the bridge bundle, and says what does not apply');
  const tplFile = Object.values(T.WS.files).find(x => x.name.endsWith('.elementor-template.json')); const tpl = JSON.parse(tplFile.text); const bun = JSON.parse(Object.values(T.WS.files).find(x => x.name.endsWith('.bundle.json')).text);
  ok(tpl.title === 'Furnace Repair in Frisco | Northside Comfort' && tpl.content[0].elType === 'container' && tpl.version === '0.4' && bun.slug === 'lp-furnace-frisco' && bun.status === 'draft' && bun.template === 'elementor_canvas' && bun.seo.noindex === true && bun.elementor_data.length === 1 && bun.content_html.includes('<h1>'), 'the template imports into Elementor; the bundle is a draft with the slug, the canvas template, noindex and the tree');
  const prev = Object.values(T.WS.files).find(x => x.name.endsWith('.preview.html')).text; ok(prev.startsWith('<!DOCTYPE html><html lang="en">') && prev.includes('<meta name="robots" content="noindex,follow">') && prev.includes('<title>Furnace Repair in Frisco | Northside Comfort</title>'), 'the preview is a whole document with the title and the noindex tag');
  const ex = await run('elementor_export', { doc: L.doc, title: 'Reusable landing' }); ok(ex.file.name === 'reusable-landing.elementor-template.json' && /Import Templates/.test(ex.note), 'elementor_export writes a template file');
  ok(D.tools.summary().pages === 1 && D.tools.summary().docs === 1 && D.tools.summary().current === '/lp-furnace-frisco/', 'the workshop summary counts pages, documents and files');
  ok((await run('page_delete', { id: P.id })).deleted === '/lp-furnace-frisco/' && (await run('page_list')).pages.length === 0 && await throwsAsync(() => run('page_get', { id: P.id }), /No workshop page/), 'page_delete removes it from the workshop only');
}

/* ============ an html page ============ */
{
  const { run, T } = boot();
  const html = '<section id="hero" class="forge-section"><div class="forge-inner"><h1>Duct Cleaning in Allen</h1><p class="forge-lede">Lic TACLA00000E. ' + 'Clean air for Allen homes. '.repeat(30) + '</p><p><a class="forge-btn forge-btn-primary" href="tel:+19725550100">Call (972) 555 0100</a></p></div></section><script>alert(1)</script>';
  const P = await run('page_create', { kind: 'html', page: { slug: 'duct-cleaning-allen', title: 'Duct Cleaning in Allen – Northside Comfort', meta_description: 'Duct cleaning for Allen homes with written prices before work starts and a licensed local crew that shows up on time.' }, html });
  ok(P.kind === 'html' && P.slug === 'duct-cleaning-allen' && P.words > 100 && /workbench/.test(P.preview) && T.WS.pages[P.id].html.includes('<script>'), 'page_create (html) stores the page (script stripping is the publish layer\'s, absent here) and reports words and checks', JSON.stringify(P.checks));
  const dup = await run('page_create', { kind: 'html', page: { slug: 'duct-cleaning-allen', title: 'Second' }, html: '<p>x</p>' }); ok(dup.slug === 'duct-cleaning-allen-2' && /became "duct-cleaning-allen-2"/.test(dup.slug_changed), 'a slug already in the workshop gets a number, and the result says so');
  const Ed = await run('page_edit', { id: P.id, set: { title: 'Duct Cleaning in Allen | Northside Comfort', noindex: true, bogus: 1 }, find_replace: [{ find: 'Allen homes', replace: 'Allen and Fairview homes' }, { find: 'not there', replace: 'x' }] });
  ok(Ed.title === 'Duct Cleaning in Allen | Northside Comfort' && Ed.noindex && Ed.log.includes('set.bogus: not a field of this kind of page') && Ed.log.some(l => /find "Allen homes": 30 replaced/.test(l)) && Ed.log.some(l => /find "not there": 0 replaced/.test(l)), 'page_edit sets fields and makes exact replacements, counting each', Ed.log.join(' | '));
  ok(await throwsAsync(() => run('page_create', { page: { title: 'no slug' }, html: 'x' }), /page\.slug and page\.title are required/) && await throwsAsync(() => run('page_create', { kind: 'html', page: { slug: 'a', title: 'b' } }), /needs html/) && await throwsAsync(() => run('page_create', { page: { slug: 'a', title: 'b' }, sections: [{ type: 'hero' }] }), /Site Forge engine is not loaded/), 'missing fields are named; a blueprint page needs the dashboard and says so');
  ok(await throwsAsync(() => run('page_publish', { ids: [P.id] }), /publish layer is not loaded/) && await throwsAsync(() => run('forge_plan', {}), /Site Forge \(module 09\) is not in this build/) && await throwsAsync(() => run('atlas_markets', {}), /atlas data is not loaded/) && await throwsAsync(() => run('copy_check', { text: 'x' }), /rule pack is not loaded/), 'tools that need the dashboard say which part is missing');
}

/* ============ the WordPress tools ============ */
{
  const { run, T, writes, D } = boot({ status: 'publish' }); const tool = n => T.get(n);
  const st = await run('wp_status'); ok(st.connector.on && st.bridge.on && st.elementor === '3.32.0', 'wp_status reads the site');
  eq([tool('wp_status').origins({}), tool('wp_write').origins({}), tool('fetch_url').origins({ url: 'https://public.test/page' })], [['https://www.northside-comfort.test'], ['https://www.northside-comfort.test'], ['https://public.test', 'https://www.public.test']], 'each network tool names the site it will reach, so the loop can ask for access first');
  eq([T.sites('https://www.northside-comfort.test/x', true), T.sites('staging.northside-comfort.test'), T.sites('http://localhost:8080/'), T.sites('https://203.0.113.9/'), T.sites('not a url')], [['https://www.northside-comfort.test', 'https://northside-comfort.test', 'http://www.northside-comfort.test'], ['https://staging.northside-comfort.test'], ['http://localhost:8080'], ['https://203.0.113.9'], []], 'a site is asked for with its www twin (and its http address for the redirect check); a subdomain, a port or an IP stands alone');
  const rd = await run('wp_read', { ref: 7, load: true });
  ok(rd.status === 'publish' && rd.elementor.widgets === 4 && rd.elementor.needs_pro.join() === 'form' && rd.loaded_as && T.WS.docs[rd.loaded_as].source.id === 7 && T.WS.docs[rd.loaded_as].source.modified === '2026-11-14 09:00:00' && /\[aaa0001\]/.test(rd.outline), 'wp_read summarizes the page and loads its tree with the time it was read');
  ok((await run('wp_read', { ref: 8 })).content_excerpt === '<p>About us</p>' && await throwsAsync(() => run('elementor_load', { source: 'site', ref: '8' }), /is not built with Elementor/), 'a page without Elementor returns its content, and cannot be loaded as a document');
  await run('elementor_edit', { doc: rd.loaded_as, ops: [{ op: 'set', ref: 'aaa0002.title', value: 'Winter AC Check in Plano, TX' }] });
  eq([await tool('wp_write').risk({ doc: rd.loaded_as }, {}), await tool('wp_write').risk({ id: 7, set: { title: 'x' } }, {}), await tool('wp_write').risk({ doc: rd.loaded_as, set: { status: 'publish' } }, {})], ['live', 'live', 'live'], 'writing to a published page, or publishing, is a live change');
  const cf = tool('wp_write').confirm({ doc: rd.loaded_as, note: 'n' }, {}, 'live'); ok(cf.danger && /LIVE page/.test(cf.title) && /"AC Repair Plano" \(page 7\)/.test(cf.detail) && /Changed heading aaa0002: title: AC Repair in Plano, TX → Winter AC Check in Plano, TX/.test(cf.detail) && /backup is taken first/.test(cf.detail), 'the approval card names the page and lists what changed in words', cf.detail);
  const w = await run('wp_write', { doc: rd.loaded_as, note: 'Winter headline' });
  ok(w.backup_id === 90 && w.changed.join() === 'elementor_data' && /wp_restore with id 7 and backup_id 90/.test(w.undo) && writes[0].expect_modified === '2026-11-14 09:00:00' && writes[0].note === 'Winter headline' && writes[0].elementor_data[0].elements[0].settings.title === 'Winter AC Check in Plano, TX', 'wp_write sends the tree with the staleness stamp and reports the backup and how to undo');
  ok(T.WS.docs[rd.loaded_as].source.modified === '2026-11-14 10:00:00' && tool('wp_write').confirm({ doc: rd.loaded_as }, {}, 'live').detail.includes('"AC Repair Plano"') && !/Changed heading/.test(tool('wp_write').confirm({ doc: rd.loaded_as }, {}, 'live').detail), 'after a write the document remembers the new modified time, and has no pending changes');
  T.WS.docs[rd.loaded_as].source.modified = '2026-11-14 09:00:00';
  let e = null; try { await run('wp_write', { doc: rd.loaded_as }); } catch (x) { e = x; } ok(e && e.status === 409 && /Read it again/.test(e.hint), 'a write from a stale read is refused by the site and the hint says to read again');
  ok(await throwsAsync(() => run('wp_write', {}), /Give the id of the page on the site/) && await throwsAsync(() => run('wp_write', { id: 7 }), /Nothing to write/), 'a write with nothing to say is refused before any request');
  eq([(await run('wp_backups', { id: 7 })).backups.length, (await run('wp_restore', { id: 7, backup_id: 90 })).restored_from, tool('wp_restore').risk, tool('wp_restore').confirm({ id: 7, backup_id: 90 }).danger], [1, 90, 'live', true], 'backups list; restore is always a live change with a danger card');
  const cr = await run('wp_create', { title: 'Furnace Repair Plano', slug: 'lp-furnace-plano', clone_of: 7, doc: rd.loaded_as }); ok(cr.status === 'draft' && cr.sent.status === 'draft' && cr.sent.clone_of === 7 && cr.sent.elementor_data.length === 1 && tool('wp_create').risk === 'draft', 'wp_create makes a draft, optionally a clone carrying a workshop tree');
  eq([(await run('wp_site', { what: 'kit' })).kit_id, (await run('wp_site', { what: 'media', query: 'crew' })).results[0].id, (await run('wp_site', { what: 'urls' })).count, (await run('wp_site', { what: 'clear_cache' })).cleared[0], tool('wp_site').risk({ what: 'clear_cache' }), tool('wp_site').risk({ what: 'kit' })], [12, 3, 2, 'Elementor CSS', 'draft', 'read'], 'wp_site reads the kit, media and live urls; clearing caches asks first');
  ok((await run('wp_site', { what: 'inventory' })).db.size_bytes === 48234496 && T.session.hosting['northside-comfort.test'].inventory.wp === '6.8.2', 'the inventory is kept for the move plan');
  const lib = await run('elementor_export', { doc: rd.loaded_as, to: 'library', title: 'Winter landing' }); ok(lib.saved_to_library && lib.id === 77 && tool('elementor_export').risk({ to: 'library' }) === 'draft' && tool('elementor_export').risk({}) === 'local', 'saving to the site\'s template library goes through the bridge and asks first');
  D.wp.use(null); ok(await throwsAsync(() => run('wp_status'), /No WordPress site is connected/) && tool('wp_status').origins({}).length === 0, 'with no site connected the tools say where the credentials go (never the chat)');
}

/* ============ public pages and hosting ============ */
if (FILES.includes('dr/10_dr_html.js')) {
  const { run } = boot();
  const s = await run('fetch_url', { url: 'https://public.test/page' }); ok(s.status === 200 && s.title === 'Furnace Repair Frisco | Northside Comfort' && s.h1.join() === 'Furnace Repair in Frisco' && s.headers.server === 'nginx' && s.canonical === 'https://public.test/page' && s.phone_links.join() === 'tel:+19725550100' && s.words > 50, 'fetch_url summarizes a page: status, headers, title, canonical, headings, phone links', JSON.stringify(s).slice(0, 200));
  const h = await run('fetch_url', { url: 'https://public.test/page', part: 'html', max: 500 }); ok(h.html.length === 500 && /call again with offset 500/.test(h.more) && (await run('fetch_url', { url: 'https://public.test/page', part: 'headers' })).headers['x-powered-by'] === 'PHP/8.2' && /Furnace Repair in Frisco/.test((await run('fetch_url', { url: 'https://public.test/page', part: 'text' })).text), 'html comes in slices; headers and text are separate parts');
  const a = await run('site_audit', { url: 'https://public.test/page', kind: 'service' }); ok(typeof a.score === 'number' && a.findings.length > 0 && a.findings.every(f => f.sev && f.area && f.msg) && a.status === 200, 'site_audit scores a public page and lists findings with their fixes', `${a.score} ${a.findings.length}`);
  const sm = await run('sitemap_read', { url: 'https://public.test' }); ok(sm.count === 2 && sm.files_read === 2 && sm.sitemap === 'https://public.test/sitemap.xml' && sm.urls.join() === 'https://public.test/,https://public.test/ac-repair/', 'sitemap_read finds the sitemap and follows the index to its pages');
  const rm = await run('redirect_map', { old_urls: ['/ac-repair.html', '/about-us', '/gone-forever'], new_urls: ['https://new.test/ac-repair/', 'https://new.test/about/'], format: 'netlify' }); ok(rm.matched >= 1 && rm.file.name === '_redirects' && Array.isArray(rm.unmatched_old), 'redirect_map writes the redirect file and lists what it could not match', JSON.stringify(rm.by));
  ok(await throwsAsync(() => run('site_audit', {}), /Give a url or a page_id/) && await throwsAsync(() => run('fetch_url', { url: 'https://nowhere.test/' }), /Could not reach nowhere\.test/), 'missing input and an unreachable site are plain errors');
}
if (FILES.includes('dr/13_dr_hosting.js')) {
  const { run, T, D } = boot();
  T.session.hosting['northside-comfort.test'] = { dns: null };
  const p = await run('migration_plan', { domain: 'https://www.northside-comfort.test/', from: 'Old Host', to: 'New Host', platform: 'wordpress', email_on_domain: true, forms: true });
  const md = T.WS.files[p.file.id].text;
  ok(p.file.name === 'hosting-move-runbook-northside-comfort.test.md' && p.phases.length >= 6 && Array.isArray(p.open_questions) && p.open_questions.length > 0 && p.used.dns_lookup === false && md.length > 3000 && /rollback/i.test(md) && /MX/.test(md), 'migration_plan writes the runbook to the Files tray and returns phases, open questions and risks', p.phases.join(' | ').slice(0, 200));
  ok(T.get('dns_lookup').origins({}).every(o => /^https:\/\//.test(o)) && T.get('dns_lookup').origins({}).length === D.hosting.DOH_HOSTS.length && T.get('migration_verify').origins({ old_base: 'https://a.test', new_base: 'https://new.host.test' }).join() === 'https://a.test,https://www.a.test,https://new.host.test', 'the DNS and comparison tools name the hosts they reach');
}
/* ============ blueprint helpers: the anchors the calls to action need, and text replacement that leaves structure alone ============ */
{
  const { T } = boot();
  const cta = { primary: { label: 'Book service', url: '#contact' }, secondary: { label: 'How it works', url: '#how-it-works' } };
  const secs = T.anchorSections([{ type: 'hero', h1: 'x' }, { type: 'steps', heading: 'A' }, { type: 'steps', heading: 'B' }, { type: 'form', heading: 'Book' }, { type: 'form', heading: 'Again' }], cta);
  eq(secs.map(s => s.id || ''), ['', 'how-it-works', '', 'contact', ''], 'the first form answers #contact and the first steps #how-it-works when the author named no ids');
  eq(T.anchorSections([{ type: 'steps', id: 'process' }, { type: 'form', id: 'quote' }, { type: 'rich_text', id: 'contact' }], cta).map(s => s.id), ['process', 'quote', 'contact'], 'an id the author chose is kept, and an id already on the page is not given twice');
  eq(T.anchorSections([{ type: 'form' }, { type: 'steps' }], { primary: { url: '/book/' } }).map(s => s.id || ''), ['', ''], 'no anchor is invented when the calls to action point at a page');
  const bp = { page: { title: 'AC Repair | Book service', slug: 'book-service', cta: { primary: { label: 'Book service', url: '#book-service' } }, _facts: ['Book service'] }, sections: [{ type: 'hero', id: 'book-service', h1: 'Book service today', cta: ['primary'] }, { type: 'faq', items: [{ q: 'How do I Book service?', a: 'Tap Book service. Book service is quick.' }] }] };
  const n = T.replaceCopy(bp.sections, 'Book service', 'Schedule a visit') + T.replaceCopy(bp.page, 'Book service', 'Schedule a visit');
  ok(n === 6 && bp.sections[0].h1 === 'Schedule a visit today' && bp.sections[0].id === 'book-service' && bp.page.slug === 'book-service' && bp.page.cta.primary.url === '#book-service' && bp.page.cta.primary.label === 'Schedule a visit' && bp.page.title === 'AC Repair | Schedule a visit' && bp.sections[1].items[0].a === 'Tap Schedule a visit. Schedule a visit is quick.' && bp.page._facts[0] === 'Book service', 'find and replace reaches every piece of copy and never an id, a slug, a link or a private field', String(n));
  eq([T.pageFields({ kind: 'blueprint', blueprint: { page: { h1: 'A', noindex: true } }, page: { h1: 'wrong' } }).h1, T.pageFields({ kind: 'html', page: { h1: 'B' } }).h1, T.pageFields({ kind: 'html' }).h1], ['A', 'B', undefined], 'a blueprint keeps its page fields inside the blueprint; the other kinds beside the content');
}

/* ============ ask_user ============ */
{
  const a = boot({ answer: 'Frisco' }); const r = await a.run('ask_user', { question: 'Which city?', options: ['Frisco', 'Plano'] }); ok(r.answer === 'Frisco' && a.asks[0].kind === 'question' && a.asks[0].options.length === 2, 'ask_user returns the chosen answer');
  const b = boot({ answer: null }); ok((await b.run('ask_user', { question: 'Which city?', options: ['a', 'b'] })).answer === null, 'a dismissed question returns no answer, and says not to assume one');
}
done();
