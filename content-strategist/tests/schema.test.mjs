/* lib/schema.mjs: the graph for each kind of page, its validation, and the blueprint compiled by the Site Forge's own
   compiler, taken from the DFW atlas inside the console. */
import vm from 'node:vm';
import { ok, done, read, json } from './_t.mjs';
import { parseMarkdown } from '../lib/doc.mjs';
import { buildSchema, validate, blueprint, business, pageUrl } from '../lib/schema.mjs';
import { loadPack, consolePayloads } from '../lib/atlas.mjs';
import { matchClose } from '../lib/literal.mjs';

const pack = loadPack('dfw'), brand = json('brand.json'), base = 'https://www.example-air.test';
const mk = (file, type) => { const doc = parseMarkdown(read(file)), slug = doc.meta.slug, url = pageUrl(type === 'blog' ? Object.assign({}, doc.meta, { path: '/blog/' + slug + '/' }) : doc.meta, brand, slug); return { doc, slug, url, schema: buildSchema({ doc, brand, pack, type, url, slug, date: '2026-11-14' }) }; };
const node = (s, t) => s['@graph'].find(n => n['@type'] === t);

/* ---- a landing page ---- */
const L = mk('landing.md', 'landing'), g = L.schema['@graph'];
ok(L.url === base + '/ac-repair-plano-tx/' && g.map(n => n['@type']).join() === 'HVACBusiness,WebSite,BreadcrumbList,WebPage,Service', 'a landing page: the business, the site, the breadcrumb, the page, the service', g.map(n => n['@type']));
const biz = node(L.schema, 'HVACBusiness'), svc = node(L.schema, 'Service'), page = node(L.schema, 'WebPage');
ok(biz['@id'] === base + '/#organization' && biz.telephone === brand.phone && biz.address.addressLocality === 'Plano' && biz.identifier.value === 'TACLA00000E' && biz.identifier.propertyID === 'TDLR license' && biz.areaServed.length === 6 && !('aggregateRating' in biz) && !('email' in biz), 'the business comes from the brand file, with the license, and with no rating and no empty field');
ok(svc.provider['@id'] === biz['@id'] && svc.areaServed['@type'] === 'City' && svc.areaServed.name === 'Plano' && svc.areaServed.containedInPlace.name === 'Texas' && svc.serviceType === 'Air conditioning repair' && svc.name === L.doc.h1, 'the service names its provider, its city and its type');
ok(page.mainEntity['@id'] === svc['@id'] && page.speakable.cssSelector.includes('.answer') && page.breadcrumb['@id'].endsWith('#breadcrumb') && page.description === L.doc.meta.description && page.dateModified === '2026-11-14' && page.mentions[0].sameAs.startsWith('https://en.wikipedia.org/wiki/'), 'the page points at its service, its breadcrumb and the paragraph a result can quote');
ok(node(L.schema, 'BreadcrumbList').itemListElement.map(x => x.name).join(' > ') === 'Home > Plano > AC Repair in Plano, TX', 'the breadcrumb runs home, parent, page');
let v = validate(L.schema, { doc: L.doc, url: L.url });
ok(v.ok && !v.errors.length, 'it validates against its page', v.errors);

/* ---- a blog post and a content page ---- */
const B = mk('blog.md', 'blog'), art = node(B.schema, 'BlogPosting');
ok(art && art.headline === B.doc.h1 && art.author['@type'] === 'Person' && art.author.name === 'Sam Rivera' && art.author.jobTitle === 'Service Manager' && art.publisher['@id'] === base + '/#organization' && art.datePublished === '2026-11-14' && art.image.endsWith('frozen-coil.jpg') && art.wordCount === B.doc.words && art.keywords.startsWith('ac frozen coil') && art.mainEntityOfPage['@id'] === B.url + '#webpage', 'a blog post: a BlogPosting with its author, dates, image, keywords and word count');
ok(validate(B.schema, { doc: B.doc, url: B.url }).ok, 'it validates');
const C = (() => { const doc = parseMarkdown(read('blog.md').replace('type: blog', 'type: page').replace(/author:.*\n/, '')), url = pageUrl(doc.meta, brand, doc.meta.slug); return { doc, url, schema: buildSchema({ doc, brand, pack, type: 'page', url, date: '2026-11-14' }) }; })();
ok(node(C.schema, 'Article') && !node(C.schema, 'BlogPosting') && node(C.schema, 'Article').author['@id'] === base + '/#organization' && validate(C.schema, { doc: C.doc, url: C.url }).ok, 'a content page: an Article; with no named author the business is the author, and no person is invented');
ok(!node(L.schema, 'FAQPage') && !node(B.schema, 'FAQPage') && !node(B.schema, 'HowTo'), 'no FAQ or HowTo schema unless the request allows it');
const F = (() => { const doc = parseMarkdown('---\ntitle: T\ndescription: D\nkeyword: k\n---\n# Q page\n\nLede.\n\n## Why does a coil freeze?\n\nLow airflow.\n\n## Can I thaw it?\n\nYes, with the fan.\n'), url = base + '/q/'; return { doc, url, yes: buildSchema({ doc, brand, pack, type: 'page', url, date: '2026-11-14', allow: ['faq'] }), no: buildSchema({ doc, brand, pack, type: 'page', url, date: '2026-11-14' }) }; })();
ok(node(F.yes, 'FAQPage').mainEntity.length === 2 && !node(F.no, 'FAQPage') && validate(F.yes, { doc: F.doc, url: F.url, allow: ['faq'] }).ok && !validate(F.yes, { doc: F.doc, url: F.url }).ok, 'an FAQ the request asked for gets FAQPage schema, and only then');

/* ---- validation catches what must not ship ---- */
const broke = fn => { const s = JSON.parse(JSON.stringify(L.schema)); fn(s['@graph'], s); return validate(s, { doc: L.doc, url: L.url }); };
ok(!broke(G => { G.find(n => n['@type'] === 'Service').provider = { '@id': base + '/#nobody' }; }).ok, 'a reference to a node that is not in the graph');
ok(!broke(G => { G[0].aggregateRating = { '@type': 'AggregateRating', ratingValue: 4.9, reviewCount: 900 }; }).ok, 'a rating');
ok(!broke(G => { G.find(n => n['@type'] === 'Service').name = 'Something else'; }).ok && !broke(G => { G.find(n => n['@type'] === 'WebPage').description = 'Other'; }).ok, 'a name or description the page does not show');
ok(!broke(G => { G.find(n => n['@type'] === 'WebPage').name = 'AC Repair in [City]'; }).ok && !broke(G => { G[0].logo = '/logo.png'; }).ok && !broke(G => { G.find(n => n['@type'] === 'WebPage').datePublished = 'last week'; }).ok, 'a placeholder, a relative URL, a date that is not ISO');
ok(!broke(G => { G.splice(G.findIndex(n => n['@type'] === 'Service'), 1); }).ok && !broke((G, s) => { s['@context'] = 'http://schema.org/'; }).ok, 'a page with no Service or Article node, a wrong context');
ok(!validate({ '@context': 'https://schema.org', '@graph': [] }).ok && business({ name: 'X', url: 'https://x.test' }, null)['@type'] === 'LocalBusiness' && business({ name: 'X', url: 'https://x.test' }, loadPack('dental'))['@type'] === 'Dentist', 'an empty graph fails; the business type follows the vertical');

/* ---- the blueprint, compiled by the Site Forge itself ---- */
const dfw = consolePayloads().find(p => p.id === 'dfw').text, at = dfw.indexOf('const FORGE_COMPILE=(()=>{'), open = dfw.indexOf('(()=>{', at) + 5, box = {};
vm.runInNewContext(dfw.slice(at, matchClose(dfw, open) + 1) + ')();\nthis.F = FORGE_COMPILE;', box, { timeout: 5000 });
for (const [name, X, type] of [['landing', L, 'landing'], ['blog', B, 'blog']]) {
  const bp = blueprint({ doc: X.doc, brand, pack, schema: X.schema, type, slug: X.slug, url: X.url }), r = box.F.compile(JSON.parse(JSON.stringify(bp)), {});
  const types = r.schema['@graph'].map(n => n['@type']), blocks = r.lint.filter(w => /^BLOCK/.test(w));
  ok(r.html.includes('<h1>' + X.doc.h1.replace(/&/g, '&amp;')) && r.html.includes('forge-answer') && r.elementor_data.length >= 4 && !blocks.length, `the ${name} blueprint compiles in the Site Forge: HTML, Elementor sections, nothing blocked`, r.lint);
  ok(types.includes('HVACBusiness') && types.includes(type === 'landing' ? 'Service' : 'Article') && r.schema['@graph'].find(n => n['@type'] === 'HVACBusiness')['@id'] === base + '/#organization' && r.seo.title === X.doc.meta.title, `and the Forge's own schema carries the same business id`, types);
  ok(bp.page.archetype === (type === 'landing' ? 'location' : 'article') && bp.sections[0].type === 'hero' && bp.sections[1].type === 'answer' && !bp.sections.some(s => s.type === 'faq') && bp.page.internal_links.length >= 4 && (type !== 'landing' || bp.sections.some(s => s.type === 'form')), `${name}: hero, answer, sections, no FAQ; a landing page ends on the form`);
}
done();
