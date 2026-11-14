/* src/dr/11_dr_elementor.js: parsing every shape, validation, the outline, slots, each edit op, diff, the approximate
   rendering, the export file and the bridge bundle. Fixtures are hand written in the shapes Elementor exports. */
import { makeContext, load, suite } from './lib/load.mjs';
const { ok, eq, done } = suite();
const ctx = makeContext(); load(ctx, ['dr/00_dr_core.js', 'dr/11_dr_elementor.js']);
const E = ctx.DRHVAC.elementor;

const w = (id, type, settings, extra) => Object.assign({ id, elType: 'widget', widgetType: type, settings, elements: [] }, extra || {});
const c = (id, settings, elements, inner) => ({ id, elType: 'container', settings, elements, isInner: !!inner });
/* a landing page template the way a container based site exports it */
const TEMPLATE = {
  version: '0.4', title: 'Service landing', type: 'page', page_settings: { hide_title: 'yes', template: 'elementor_canvas' },
  content: [
    c('aaa0001', { content_width: 'boxed', boxed_width: { unit: 'px', size: 1140 }, flex_direction: 'row', flex_direction_mobile: 'column', flex_gap: { unit: 'px', size: 40, column: '40', row: '24' }, html_tag: 'section', _element_id: 'hero', css_classes: 'lp-hero', background_background: 'classic', background_color: '#173A69', background_image: { url: 'https://old.example/wp-content/uploads/hero.jpg', id: 812 }, padding: { unit: 'px', top: '72', right: '20', bottom: '72', left: '20', isLinked: false } }, [
      c('aaa0002', { width: { unit: '%', size: 55 }, flex_direction: 'column' }, [
        w('aaa0003', 'heading', { title: 'AC Repair in Plano, TX', header_size: 'h1', title_color: '#ffffff', __globals__: { typography_typography: 'globals/typography?id=primary' } }),
        w('aaa0004', 'text-editor', { editor: '<p>Same day <strong>AC repair</strong> for Plano homes. Call <a href="tel:+19725550100">(972) 555 0100</a>.</p>', text_color: '#ffffff' }),
        w('aaa0005', 'button', { text: 'Book AC repair', link: { url: '#contact', is_external: '', nofollow: '' }, background_color: '#EDD21C', button_text_color: '#112337' }),
        w('aaa0006', 'icon-list', { icon_list: [{ text: 'TDLR Lic TACLA00000E', _id: 'r000001' }, { text: 'Written prices', _id: 'r000002', link: { url: '/pricing/' } }] }),
      ], true),
      c('aaa0007', { width: { unit: '%', size: 45 } }, [w('aaa0008', 'image', { image: { url: 'https://old.example/wp-content/uploads/tech.webp', id: 815, alt: 'Technician at a condenser', source: 'library' }, image_size: 'large' })], true),
    ]),
    c('bbb0001', { content_width: 'boxed', boxed_width: { unit: 'px', size: 820 }, flex_direction: 'column', html_tag: 'section', _element_id: 'faq' }, [
      w('bbb0002', 'heading', { title: 'Questions Plano homeowners ask', header_size: 'h2', __dynamic__: { title: '[elementor-tag id="x" name="post-title" settings="%7B%7D"]' } }),
      w('bbb0003', 'accordion', { tabs: [{ tab_title: 'How fast can you come?', tab_content: '<p>Most Plano calls are seen the same day.</p>', _id: 'q000001' }, { tab_title: 'Do you price first?', tab_content: '<p>Yes, in writing.</p>', _id: 'q000002' }], title_html_tag: 'h3' }),
    ]),
    c('ccc0001', { content_width: 'boxed', flex_direction: 'column', html_tag: 'section', _element_id: 'contact', background_background: 'classic', background_color: '#eef2f6' }, [
      w('ccc0002', 'form', { form_name: 'Lead form', form_fields: [{ custom_id: 'name', field_label: 'Full name', field_type: 'text', required: 'true', _id: 'f000001' }, { custom_id: 'phone', field_label: 'Phone', field_type: 'tel', required: 'true', _id: 'f000002' }, { custom_id: 'consent', field_label: 'I agree to be contacted.', field_type: 'acceptance', required: 'true', _id: 'f000003' }], button_text: 'Send my request', email_to: 'leads@old.example' }),
      w('ccc0003', 'testimonial', { testimonial_content: 'They came the same afternoon.', testimonial_name: 'R. Alvarez', testimonial_job: 'Plano' }),
      w('ccc0004', 'fancy-countdown-x', { main_title: 'Offer ends soon', badge_text_color: '#ff0000', promo_image: { url: 'https://old.example/p.png', id: 9 } }),
    ]),
  ],
};
/* the older stack: section, column, widget, with an inner section */
const LEGACY = [{ id: 'sec0001', elType: 'section', settings: [], elements: [
  { id: 'col0001', elType: 'column', settings: { _column_size: 50 }, elements: [w('leg0001', 'heading', { title: 'Furnace repair', header_size: 'h1' }), { id: 'sec0002', elType: 'section', isInner: true, settings: {}, elements: [{ id: 'col0003', elType: 'column', settings: { _column_size: 100 }, elements: [w('leg0003', 'button', { text: 'Call now', link: { url: 'tel:+19725550100' } })] }] }] },
  { id: 'col0002', elType: 'column', settings: { _column_size: 50 }, elements: [w('leg0002', 'image', { image: { url: 'https://old.example/f.jpg', id: 3 } })] },
] }];

/* ---- parse ---- */
let p = E.parse(JSON.stringify(TEMPLATE));
ok(p.ok && p.doc.title === 'Service landing' && p.doc.type === 'page' && p.doc.elements.length === 3 && p.doc.page_settings.template === 'elementor_canvas' && !p.problems.length, 'a template export parses with its title, type and page settings');
ok(E.parse(TEMPLATE.content).ok && E.parse({ elementor_data: TEMPLATE.content, title: 'B' }).doc.title === 'B' && E.parse({ elementor_data: JSON.stringify(TEMPLATE.content) }).ok && E.parse({ template: TEMPLATE }).doc.title === 'Service landing' && E.parse({ elementor: { data: LEGACY, page_settings: {} }, title: 'C' }).doc.elements.length === 1 && E.parse(TEMPLATE.content[0]).doc.elements.length === 1, 'a raw array, a bundle (array or string), a compile result, a connector document and a single element all parse');
ok(!E.parse('{nope').ok && /Not JSON/.test(E.parse('{nope').problems[0]) && !E.parse({ hello: 1 }).ok && /No Elementor element tree/.test(E.parse({ hello: 1 }).problems[0]), 'bad JSON and JSON that is not a template are refused with the reason');
const L = E.parse(LEGACY).doc.elements;
ok(E.parse(LEGACY).ok && !Array.isArray(L[0].settings) && typeof L[0].settings === 'object', 'an empty settings array (how PHP writes it) becomes an object');
const noId = E.parse([{ elType: 'container', settings: {}, elements: [{ elType: 'widget', widgetType: 'heading', settings: { title: 'x' } }] }]);
ok(noId.ok && /^[0-9a-f]{7}$/.test(noId.doc.elements[0].id) && noId.problems.length === 2, 'elements without ids get one, and the report says so');
const DOC = p.doc, T = DOC.elements;

/* ---- validate ---- */
let v = E.validate(T);
ok(v.ok && v.stats.containers === 5 && v.stats.widgets === 10 && v.stats.top === 3 && v.stats.usesContainers && !v.stats.legacy && v.stats.depth === 3, 'the container tree is valid; counts and depth are right', JSON.stringify(v.stats));
eq([v.stats.pro, v.stats.unknown, v.stats.dynamic, v.stats.globals, v.stats.images], [['form'], ['fancy-countdown-x'], 1, 1, 3], 'Pro widgets, unknown widgets, dynamic tags, global styles and images are counted');
ok(v.warnings.some(x => /Needs Elementor Pro on the site: form/.test(x)) && v.warnings.some(x => /not checked here: fancy-countdown-x/.test(x)), 'the warnings name the Pro widget and the unknown one');
v = E.validate(L); ok(v.ok && v.stats.legacy && v.stats.sections === 2 && v.stats.columns === 3 && v.stats.widgets === 3, 'the section and column stack is valid, inner section included');
const bad = [w('x1', 'heading', { title: 'loose' }), { id: 'dup0001', elType: 'section', settings: {}, elements: [w('dup0001', 'button', { text: 'b' })] }, { id: 'colx001', elType: 'column', settings: {}, elements: [] }, { id: 'zzz0001', elType: 'blob', settings: {}, elements: [] }, { id: 'www0001', elType: 'widget', settings: {}, elements: [] }];
v = E.validate(bad);
ok(!v.ok && ['a widget at the top level', 'directly inside a section', 'a column at the top level', 'a column outside a section', 'a widget without a widgetType', 'duplicate element ids: dup0001'].every(m => v.errors.some(e => e.includes(m))) && v.warnings.some(x => /element type "blob" is not one this toolkit knows/.test(x)) && v.stats.otherTypes.join() === 'blob', 'each structural mistake is named; an element type from a newer Elementor is a warning, not an error', v.errors.join(' | '));
ok(E.validate('nope').ok === false, 'a non array is refused');

/* ---- outline ---- */
const out = E.outline(T);
ok(out.split('\n').length === 15 && out.includes('[aaa0001] container (row, boxed, #hero, .lp-hero, bg #173A69)') && out.includes('    [aaa0003] heading (h1) "AC Repair in Plano, TX"') && out.includes('  [bbb0003] accordion "How fast can you come?"') && out.includes('[ccc0002] form "Lead form"'), 'the outline shows every element with its type, layout hints and first text', out.split('\n').slice(0, 4).join(' / '));
ok(E.outline(T, { depth: 1 }).split('\n').length === 4 && /… 2 inside/.test(E.outline(T, { depth: 1 })) && /more elements not shown/.test(E.outline(T, { depth: 1 })), 'a depth limit summarizes what is inside');

/* ---- slots ---- */
const S = E.slots(T); const by = ref => S.find(s => s.ref === ref);
ok(by('aaa0003.title').value === 'AC Repair in Plano, TX' && by('aaa0003.title').kind === 'text' && by('aaa0004.editor').kind === 'html' && by('aaa0004.editor').text === 'Same day AC repair for Plano homes. Call (972) 555 0100 .' && by('aaa0005.link.url').value === '#contact', 'heading, rich text (with its plain text) and a button link are slots');
ok(by('aaa0006.icon_list[1].text').value === 'Written prices' && by('aaa0006.icon_list[1].link.url').value === '/pricing/' && !by('aaa0006.icon_list[0].link.url') && by('bbb0003.tabs[1].tab_content').kind === 'html' && by('ccc0002.form_fields[2].field_label').kind === 'field', 'repeater rows have one reference each; an empty link is not a slot');
ok(by('aaa0008.image').value.url.endsWith('tech.webp') && by('aaa0008.image').value.id === 815 && by('aaa0001.background_image').kind === 'image' && by('aaa0001.background_image').widget === 'container', 'images and a container background image are slots');
ok(by('bbb0002.title').dynamic === true && by('aaa0003.title').dynamic === false, 'a slot driven by a dynamic tag is marked');
ok(by('ccc0004.main_title').guess === true && by('ccc0004.promo_image').kind === 'image' && by('ccc0004.promo_image').guess && !S.some(s => s.ref === 'ccc0004.badge_text_color'), 'an unmapped widget offers what looks like content, marked as a guess, and never a color');
ok(E.slots(T, { el: 'aaa0002' }).every(s => /^aaa000[3-6]\./.test(s.ref)) && E.slots(T, { el: 'aaa0002' }).length === 7 && E.slots(T, { kinds: ['image'] }).length === 3 && E.slots(T, { el: 'nope' }).length === 0 && E.slots(T, { max: 3 }).length === 3, 'slots can be limited to one element and what is inside it, to kinds, or to a count');
ok(E.words(T) > 40 && E.text(T).includes('They came the same afternoon.') && E.text(T).includes('Full name') && !E.text(T).includes('<p>'), 'text() is every visible word, tags stripped');
eq(E.images(T).map(i => [i.id, i.widget]), [[812, 'container'], [815, 'image'], [9, 'fancy-countdown-x']], 'images() lists each image with its attachment id and where it sits');

/* ---- design ---- */
const dz = E.design(T, DOC.page_settings);
ok(dz.colors.find(x => x.value === '#ffffff').count === 2 && dz.colors.some(x => x.value === '#173a69') && dz.globals[0].value === 'globals/typography?id=primary', 'colors (lower cased) and global styles in use are counted', JSON.stringify(dz.colors.slice(0, 3)));

/* ---- apply: one of each op ---- */
let r = E.apply(T, [
  { op: 'set', ref: 'aaa0003.title', value: 'Furnace Repair in Frisco, TX' },
  { op: 'set', ref: 'aaa0005.link.url', value: 'tel:+19725550199' },
  { op: 'set', ref: 'aaa0008.image', value: { url: 'https://new.example/uploads/crew.webp', alt: 'Crew at a furnace' } },
  { op: 'set', ref: 'aaa0001.background_image', value: 'https://new.example/uploads/hero.webp' },
  { op: 'set', ref: 'bbb0002.title', value: 'Questions Frisco homeowners ask' },
  { op: 'replace_text', find: 'Plano', replace: 'Frisco' },
  { op: 'replace_url', find: 'old.example', replace: 'new.example' },
  { op: 'replace_color', find: '#173a69', replace: '#0b6f6d' },
  { op: 'set_setting', el: 'aaa0001', key: 'padding.top', value: '96' },
  { op: 'set_setting', el: 'aaa0001', key: 'css_classes', value: null },
  { op: 'list_add', el: 'aaa0006', key: 'icon_list', item: { text: 'Financing available' } },
  { op: 'list_remove', el: 'bbb0003', key: 'tabs', index: 0 },
  { op: 'list_move', el: 'ccc0002', key: 'form_fields', from: 1, to: 0 },
  { op: 'duplicate', el: 'ccc0003' },
  { op: 'remove', el: 'ccc0004' },
  { op: 'move', el: 'bbb0001', parent: 'root', index: 2 },
  { op: 'insert', parent: 'root', index: 1, elements: [c('aaa0001', { flex_direction: 'column' }, [w('aaa0003', 'heading', { title: 'Inserted band', header_size: 'h2' })])] },
]);
const N = r.elements; const g = (id, path) => E.getPath(E.find(N, id).el.settings, path);
ok(r.log.length === 17 && r.log.every(l => l.ok) && r.changed === 17, 'seventeen ops, all applied', r.log.filter(l => !l.ok).map(l => l.op + ': ' + l.note).join(' | '));
ok(JSON.stringify(T) === JSON.stringify(p.doc.elements) && g('aaa0003', 'title') === 'Furnace Repair in Frisco, TX' && E.getPath(E.find(T, 'aaa0003').el.settings, 'title') === 'AC Repair in Plano, TX', 'apply returns a new tree and leaves the input untouched');
eq([g('aaa0005', 'link.url'), g('aaa0005', 'link.is_external')], ['tel:+19725550199', ''], 'setting a link keeps the link object\'s other fields');
eq(g('aaa0008', 'image'), { url: 'https://new.example/uploads/crew.webp', id: 815, alt: 'Crew at a furnace', source: 'library' }, 'setting an image with an object merges (the caller decides the id)');
eq(g('aaa0001', 'background_image'), { url: 'https://new.example/uploads/hero.webp', id: '' }, 'setting an image by url clears the old attachment id, so the old site\'s image number is never reused');
ok(/dynamic tag/.test(r.log[4].note) && g('bbb0002', 'title') === 'Questions Frisco homeowners ask', 'setting a slot under a dynamic tag works and warns that WordPress overrides it');
ok(/^[1-9]\d* replacements$/.test(r.log[5].note) && g('aaa0004', 'editor').includes('for Frisco homes') && g('ccc0003', 'testimonial_job') === 'Frisco' && g('bbb0003', 'tabs[0].tab_title') === 'Do you price first?', 'replace_text reaches every text and html slot', r.log[5].note);
ok(g('ccc0002', 'email_to') === 'leads@old.example' && !JSON.stringify(N).includes('old.example/wp-content'), 'replace_url changes urls, not an email address field');
ok(g('aaa0001', 'background_color') === '#0b6f6d' && r.log[7].note === '1 color value changed', 'replace_color matches a hex whatever its case');
eq([g('aaa0001', 'padding.top'), g('aaa0001', 'css_classes'), g('aaa0006', 'icon_list').length, typeof g('aaa0006', 'icon_list[2]._id'), g('ccc0002', 'form_fields[0].custom_id')], ['96', undefined, 3, 'string', 'phone'], 'a nested setting, a cleared setting, a new repeater row with its own id, and a moved row');
const dupNote = r.log[13].note.match(/duplicated as ([0-9a-f]{7})/); ok(dupNote && E.find(N, dupNote[1]).el.settings.testimonial_name === 'R. Alvarez' && !E.find(N, 'ccc0004') && N[N.length - 1].id === 'bbb0001', 'duplicate makes a copy with a new id, remove drops the element, move puts the FAQ last');
const ins = N[1]; ok(ins.id !== 'aaa0001' && ins.elements[0].id !== 'aaa0003' && ins.elements[0].settings.title === 'Inserted band' && E.validate(N).ok, 'inserted elements get fresh ids, so a pasted section never collides; the result is valid');
/* failures are reported, not thrown, and do not stop the rest */
r = E.apply(T, [{ op: 'set', ref: 'nope000.title', value: 'x' }, { op: 'set', ref: 'aaa0003', value: 'x' }, { op: 'replace_text', find: 'Zzyzx', replace: 'y' }, { op: 'replace_color', find: 'blue', replace: '#000' }, { op: 'move', el: 'aaa0001', parent: 'aaa0002' }, { op: 'list_remove', el: 'aaa0006', key: 'icon_list', index: 9 }, { op: 'list_add', el: 'aaa0003', key: 'title', item: {} }, { op: 'insert', parent: 'root', elements: [{ nope: 1 }] }, { op: 'explode' }, 'junk', { op: 'set', ref: 'aaa0003.title', value: 'Still applied' }]);
eq(r.log.map(l => l.ok), [false, false, false, false, false, false, false, false, false, false, true], 'ten bad ops are each refused with a reason and the good one still applies');
ok(/no element nope000/.test(r.log[0].note) && /needs a path/.test(r.log[1].note) && /not found in any text/.test(r.log[2].note) && /must be a hex color/.test(r.log[3].note) && /into itself/.test(r.log[4].note) && /has 2 rows/.test(r.log[5].note) && /is not a list/.test(r.log[6].note) && /not inserted: an element without an elType/.test(r.log[7].note) && /unknown op "explode"/.test(r.log[8].note) && r.changed === 1, 'the reasons are specific', r.log.map(l => l.note).join(' | '));
r = E.apply(T, [{ op: 'regen_ids' }]); const idsA = [], idsB = []; E.walk(T, e => idsA.push(e.id)); E.walk(r.elements, e => idsB.push(e.id));
ok(idsA.length === idsB.length && idsB.every(x => !idsA.includes(x)) && new Set(idsB).size === idsB.length && E.getPath(r.elements[1].elements[1].settings, 'tabs[0]._id') !== 'q000001', 'regen_ids renews every element id and every repeater row id');

/* ---- detachMedia ---- */
const dm = E.detachMedia(T);
ok(dm.cleared === 3 && E.images(dm.elements).every(i => i.id === '' || i.id === 0 || i.id === undefined) && E.images(dm.elements)[1].url.endsWith('tech.webp') && E.images(T)[1].id === 815 && E.find(dm.elements, 'aaa0008').el.settings.image.source === 'url', 'detachMedia clears attachment ids (the urls stay) on a copy', dm.cleared);

/* ---- diff ---- */
const after = E.apply(T, [{ op: 'set', ref: 'aaa0003.title', value: 'New headline' }, { op: 'remove', el: 'ccc0004' }, { op: 'duplicate', el: 'aaa0005' }, { op: 'move', el: 'aaa0006', parent: 'aaa0007' }]).elements;
const d = E.diff(T, after);
ok(!d.same && d.removed.length === 1 && d.added.length === 1 && d.moved.join() === 'icon-list aaa0006' && d.changed.length === 1 && d.changed[0].keys.join() === 'title' && /Changed heading aaa0003: title: AC Repair in Plano, TX → New headline/.test(d.summary) && /Removed 1: fancy-countdown-x ccc0004/.test(d.summary), 'diff says what was added, removed, moved and changed, in words', d.summary);
ok(E.diff(T, E.parse(JSON.stringify(T)).doc.elements).same && E.diff(T, T).summary === 'No differences.', 'identical trees have no differences');

/* ---- toHtml ---- */
const h = E.toHtml(T);
ok(h.html.includes('<section id="hero" class="e-con e-row-dir e-stack e-boxed lp-hero" data-el="aaa0001"') && h.html.includes('<h1 style="color:#ffffff">AC Repair in Plano, TX</h1>') && h.html.includes('<a class="e-btn" href="#contact" style="background:#EDD21C;color:#112337">Book AC repair</a>') && h.html.includes('max-width:1140px;flex-direction:row;gap:40px'), 'containers become sections with their id, classes and flex layout; a heading and a button render');
ok(h.html.includes('<img src="https://old.example/wp-content/uploads/tech.webp" alt="Technician at a condenser" loading="lazy" decoding="async">') && h.html.includes('<ul class="e-list"><li>TDLR Lic TACLA00000E</li><li><a href="/pricing/">Written prices</a></li></ul>') && h.html.includes('<details class="e-faq"><summary><h3>How fast can you come?</h3></summary><p>Most Plano calls are seen the same day.</p></details>'), 'an image with its alt, a list with a link, and the FAQ as details');
ok(h.hasForm && h.html.includes('<label for="f-ccc0002-name">Full name</label><input id="f-ccc0002-name" type="text" name="name" required>') && h.html.includes('<label class="e-consent"><input type="checkbox" name="consent" required> I agree to be contacted.</label>') && !/checked/.test(h.html), 'a form renders labelled fields and an unchecked consent box');
ok(h.html.includes('<blockquote><p>They came the same afternoon.</p><footer>R. Alvarez, Plano</footer></blockquote>') && h.html.includes('Offer ends soon') && h.css.includes('@media(max-width:767px)'), 'a testimonial, an unmapped widget\'s text, and the responsive rules');
ok(E.toHtml([w('xss0001', 'heading', { title: 'Safe', header_size: 'script' }), w('xss0002', 'button', { text: '<img src=x onerror=1>', link: { url: '"><script>' } })].map(x => c(E.eid(), {}, [x]))).html.includes('<h2>Safe</h2>') && !E.toHtml([c('q', {}, [w('xss0002', 'button', { text: '<img src=x onerror=1>', link: { url: '"><b>' } })])]).html.includes('<img src=x'), 'an odd heading tag falls back to h2; button text and urls are escaped');
const lh = E.toHtml(L).html;
ok(lh.includes('<section class="e-sec" data-el="sec0001"><div class="e-row"><div class="e-col" data-el="col0001" style="flex:0 0 50%;max-width:50%">') && lh.includes('<h1>Furnace repair</h1>') && lh.includes('href="tel:+19725550100"'), 'the section and column stack renders as rows and columns');

/* ---- exports ---- */
const tpl = E.toTemplate(DOC);
ok(tpl.content === DOC.elements && tpl.version === '0.4' && tpl.type === 'page' && tpl.title === 'Service landing' && tpl.page_settings.template === 'elementor_canvas' && Array.isArray(E.toTemplate({ elements: [], page_settings: {} }).page_settings), 'toTemplate writes the export shape (empty page settings as the array Elementor writes)');
ok(E.parse(JSON.stringify(tpl)).ok && E.diff(E.parse(JSON.stringify(tpl)).doc.elements, T).same, 'an exported template parses back to the same tree');
const b = E.toBundle(DOC, { slug: 'lp-furnace-frisco', title: 'Furnace Repair in Frisco | Northside Comfort', h1: 'Furnace Repair in Frisco, TX', meta_description: 'Furnace repair for Frisco homes.', noindex: true, template: 'elementor_canvas', schema: { '@context': 'https://schema.org' } });
eq([b.slug, b.title, b.post_title, b.status, b.post_type, b.template, b.seo.noindex, b.seo.description, b.page_settings.hide_title], ['lp-furnace-frisco', 'Furnace Repair in Frisco | Northside Comfort', 'Furnace Repair in Frisco, TX', 'draft', 'page', 'elementor_canvas', true, 'Furnace repair for Frisco homes.', 'yes'], 'toBundle fills the keys the FORGE bridge imports, as a draft');
ok(b.elementor_data === DOC.elements && b.content_html.startsWith('<style>.e-con') && b.content_html.includes('<h1') && b.schema['@context'] === 'https://schema.org' && E.toBundle(DOC, { status: 'publish', post_type: 'post' }).status === 'publish', 'the bundle carries the tree, an HTML fallback with its css, and the schema');

/* ---- Elementor's Editor V4 ("atomic") elements: read, kept whole, never edited. Shapes taken from Elementor 4.4.0's
        own prop types (html-v3, string, link, classes) and element names (e-flexbox, e-heading, e-paragraph, e-button). ---- */
{
  const S = v => ({ $$type: 'string', value: v }), H = v => ({ $$type: 'html-v3', value: { content: S(v), children: [] } });
  const V4 = { version: '0.4', title: 'V4 page', type: 'page', content: [
    { id: 'aa11bb2', elType: 'e-flexbox', settings: { classes: { $$type: 'classes', value: ['e-aa11bb2-x1'] } }, styles: { 'e-aa11bb2-x1': { id: 'e-aa11bb2-x1', label: 'local', type: 'class', variants: [{ meta: { breakpoint: 'desktop', state: null }, props: { 'background-color': { $$type: 'color', value: '#173a69' } } }] } }, editor_settings: { title: 'Hero' }, version: '0.0', interactions: [], elements: [
      { id: 'cc33dd4', elType: 'widget', widgetType: 'e-heading', settings: { tag: S('h1'), title: H('AC Repair in Plano, TX') }, styles: {}, editor_settings: {}, version: '0.0', elements: [] },
      { id: 'ee55ff6', elType: 'widget', widgetType: 'e-paragraph', settings: { paragraph: H('Same day AC repair for Plano homes.') }, elements: [] },
      { id: 'gg77hh8', elType: 'widget', widgetType: 'e-button', settings: { text: H('Book AC repair'), link: { $$type: 'link', value: { destination: { $$type: 'url', value: '#contact' }, isTargetBlank: { $$type: 'boolean', value: false } } } }, elements: [] },
      { id: 'kk11ll2', elType: 'widget', widgetType: 'e-divider', settings: [], elements: [] },
      { id: 'ii99jj0', elType: 'widget', widgetType: 'heading', settings: { title: 'A classic heading about Plano', header_size: 'h2', title_color: '#173a69' }, elements: [] },
    ] }] };
  const before = JSON.stringify(V4.content[0]); const P = E.parse(JSON.stringify(V4)); const top = P.doc.elements[0];
  ok(P.ok && P.problems.length === 0 && Object.keys(top).join() === 'id,elType,settings,styles,editor_settings,version,interactions,elements' && Object.keys(top.elements[0]).join() === 'id,elType,widgetType,settings,styles,editor_settings,version,elements' && !('isInner' in top) && top.elements[4].isInner === false && Array.isArray(top.elements[3].settings), 'an atomic element keeps every key it came with, in order, and gains none', Object.keys(top).join());
  ok(E.isAtomic(top) && E.isAtomic(top.elements[0]) && E.isAtomic(top.elements[3]) && !E.isAtomic(top.elements[4]) && E.unwrap(top.elements[0].settings.title) === 'AC Repair in Plano, TX' && E.unwrap(top.elements[2].settings.link).destination === '#contact', 'atomic elements are recognized by name or by their typed settings, and their values can be read');
  const V = E.validate(P.doc.elements);
  ok(V.ok && V.stats.atomic === 5 && V.stats.unknown.length === 0 && V.stats.otherTypes.length === 0 && V.warnings.length === 1 && /5 elements use Elementor's Editor V4 atomic format/.test(V.warnings[0]) && /not edited here/.test(V.warnings[0]), 'validation says so once, in words, instead of one warning per element', V.warnings.join(' | '));
  const O = E.outline(P.doc.elements);
  ok(/\[cc33dd4\] e-heading \(h1, V4, read only\) "AC Repair in Plano, TX"/.test(O) && /\[gg77hh8\] e-button \(V4, read only\) "Book AC repair"/.test(O) && /\[ii99jj0\] heading \(h2\) "A classic heading about Plano"/.test(O), 'the outline shows their text and marks them read only', O);
  const SL = E.slots(P.doc.elements);
  eq(SL.map(x => [x.ref, x.readonly === true]), [['cc33dd4.title', true], ['ee55ff6.paragraph', true], ['gg77hh8.text', true], ['ii99jj0.title', false]], 'their text is listed as read only slots beside the editable ones');
  ok(E.words(P.doc.elements) >= 18 && /AC Repair in Plano, TX/.test(E.text(P.doc.elements)), 'and counts toward the words on the page');
  const R = E.apply(P.doc.elements, [{ op: 'replace_text', find: 'Plano', replace: 'Frisco' }, { op: 'set', ref: 'cc33dd4.title', value: 'New' }, { op: 'set_setting', el: 'ee55ff6', key: 'paragraph', value: 'New' }, { op: 'list_add', el: 'gg77hh8', key: 'items', item: {} }, { op: 'duplicate', el: 'aa11bb2' }, { op: 'replace_color', find: '#173a69', replace: '#000000' }, { op: 'replace_url', find: '#contact', replace: '#book' }, { op: 'regen_ids' }]);
  eq(R.log.map(l => l.ok), [true, false, false, false, false, true, false, true], 'text, color and id operations apply to the classic elements; every edit aimed at an atomic element is refused');
  ok(/1 replacement; 2 Editor V4 atomic elements hold it too and were left as they are/.test(R.log[0].note) && /kept exactly as it is and edited in Elementor/.test(R.log[1].note) && /Duplicate it in Elementor/.test(R.log[4].note), 'each refusal says why and where to make the change', R.log.map(l => l.note).join(' | '));
  const after = R.elements[0], classic = after.elements[4]; const onlyAtomic = el => { const c = JSON.parse(JSON.stringify(el)); c.elements = c.elements.filter(x => /^e-/.test(x.widgetType || '')); return JSON.stringify(c); };
  ok(onlyAtomic(after) === onlyAtomic(JSON.parse(before)) && classic.settings.title === 'A classic heading about Frisco' && classic.settings.title_color === '#000000' && classic.id !== 'ii99jj0' && after.id === 'aa11bb2', 'after all of it the atomic elements are identical to what was loaded: ids, typed values, styles and all');
  const html = E.toHtml(P.doc.elements).html;
  ok(html.includes('<h1>AC Repair in Plano, TX</h1>') && html.includes('<p>Same day AC repair for Plano homes.</p>') && html.includes('<a class="e-btn" href="#contact">Book AC repair</a>') && html.includes('[e-divider]'), 'the approximate rendering shows their text, tags and links', html.slice(0, 300));
  ok(E.toHtml([{ id: 'x1', elType: 'widget', widgetType: 'e-button', settings: { text: H('<img src=x onerror=1>Go'), link: { $$type: 'link', value: { destination: { $$type: 'url', value: 'javascript:alert(1)' } } } }, elements: [] }]).html.includes('<a class="e-btn" href="#">Go</a>'), 'with markup and a script address in an atomic value made harmless');
  const T2 = E.toTemplate(P.doc); ok(JSON.stringify(T2.content[0].styles) === JSON.stringify(V4.content[0].styles) && T2.content[0].elements[0].settings.title.$$type === 'html-v3', 'and an exported template still carries their styles and typed values');
}
done();
