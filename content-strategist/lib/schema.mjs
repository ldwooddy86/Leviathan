/* The JSON-LD that goes out with every page. One graph of linked nodes, so a search engine or an AI answer can tell who
   wrote the page, what it is about, where the business works and how the page sits in the site:

     the business (HVACBusiness, Dentist, LegalService by vertical)   <base>/#organization
     the site                                                        <base>/#website
     the page, with its breadcrumb and the paragraph a result quotes  <url>#webpage
     a landing page   a Service with the place it serves             <url>#service
     a blog post      a BlogPosting                                  <url>#article
     a content page   an Article                                     <url>#article

   The ids match the ones the Site Forge compiles, so the two merge. Nothing here is invented: a field the brand file or
   the page does not supply is left out, and no rating or review is ever written. validate() refuses a graph with a
   dangling reference, a missing required field, a placeholder, or a claim the page does not show. */
import { words } from './readability.mjs';

const TYPE = { dfw: 'HVACBusiness', hvac: 'HVACBusiness', plumbing: 'Plumber', roofing: 'RoofingContractor', pest: 'HomeAndConstructionBusiness', dental: 'Dentist', oncology: 'MedicalClinic', ocular: 'MedicalBusiness', criminal: 'LegalService', criminal_la: 'LegalService', injury: 'LegalService', injury_la: 'LegalService', family: 'LegalService', employment: 'LegalService' };
const STATE = { TX: 'Texas', LA: 'Louisiana' };
/* subjects worth naming to a machine, by the words a keyword or angle carries */
const ENTITIES = [
  [/\b(ac|air condition|cooling|central air)\b/i, 'Air conditioning', 'https://en.wikipedia.org/wiki/Air_conditioning'],
  [/\bheat pump/i, 'Heat pump', 'https://en.wikipedia.org/wiki/Heat_pump'],
  [/\bfurnace/i, 'Furnace', 'https://en.wikipedia.org/wiki/Furnace_(central_heating)'],
  [/\b(hvac|heating and cooling|heating and air)\b/i, 'Heating, ventilation, and air conditioning', 'https://en.wikipedia.org/wiki/Heating,_ventilation,_and_air_conditioning'],
  [/\bduct/i, 'Duct (flow)', 'https://en.wikipedia.org/wiki/Duct_(flow)'],
  [/\b(indoor air|air quality|air purifier|filtration)\b/i, 'Indoor air quality', 'https://en.wikipedia.org/wiki/Indoor_air_quality'],
  [/\b(r22|r 22|freon)\b/i, 'Chlorodifluoromethane (R-22)', 'https://en.wikipedia.org/wiki/Chlorodifluoromethane'],
  [/\brefrigerant/i, 'Refrigerant', 'https://en.wikipedia.org/wiki/Refrigerant'],
  [/\bthermostat/i, 'Thermostat', 'https://en.wikipedia.org/wiki/Thermostat'],
  [/\bhail\b/i, 'Hail', 'https://en.wikipedia.org/wiki/Hail'],
];

const clean = o => { if (Array.isArray(o)) { const a = o.map(clean).filter(v => v !== undefined); return a.length ? a : undefined; } if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) { const c = clean(v); if (c !== undefined) r[k] = c; } return Object.keys(r).length ? r : undefined; } return (o === '' || o == null) ? undefined : o; };
const iso = d => { if (!d) return ''; const s = String(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const x = new Date(s); return Number.isNaN(+x) ? '' : x.toISOString().slice(0, 10); };
const abs = (u, base) => { try { return new URL(u, base + '/').href; } catch { return ''; } };
export const baseOf = brand => String((brand && brand.url) || '').replace(/\/+$/, '');

/* the address of a page: front matter url or path wins, else the slug under the site root */
export function pageUrl(meta, brand, slug) {
  const base = baseOf(brand); if (meta.url) return abs(meta.url, base);
  const p = meta.path ? String(meta.path) : '/' + slug + '/';
  return base + (p.startsWith('/') ? p : '/' + p).replace(/\/?$/, '/');
}

/* the business node, from the brand file */
export function business(brand, pack) {
  const base = baseOf(brand), a = brand.address || {};
  return clean({
    '@type': (pack && (pack.schemaType || TYPE[pack.id])) || 'LocalBusiness', '@id': base + '/#organization', name: brand.name, legalName: brand.legalName, url: base + '/', telephone: brand.phone, email: brand.email,
    logo: brand.logo, image: brand.image || brand.logo, slogan: brand.tagline, foundingDate: brand.founded ? String(brand.founded) : '',
    address: a.street || a.city ? { '@type': 'PostalAddress', streetAddress: a.street, addressLocality: a.city, addressRegion: a.state, postalCode: a.zip, addressCountry: 'US' } : undefined,
    geo: brand.geo && brand.geo.lat ? { '@type': 'GeoCoordinates', latitude: brand.geo.lat, longitude: brand.geo.lon } : undefined,
    openingHours: brand.hoursSchema, sameAs: brand.sameAs,
    identifier: brand.license ? { '@type': 'PropertyValue', propertyID: (brand.licenseLabel || (pack && pack.licenseLabel) || 'License') + ' license', value: brand.license } : undefined,
    areaServed: (brand.serviceCities || []).slice(0, 40).map(c => ({ '@type': 'City', name: c })),
    knowsAbout: (brand.services || []).slice(0, 24),
  });
}

function place(city, pack, brand) {
  const st = (pack && pack.market && pack.market.state) || (brand.address && brand.address.state) || '';
  if (city) return clean({ '@type': 'City', name: city, containedInPlace: st ? { '@type': 'State', name: STATE[st] || st } : undefined });
  if (pack && pack.market && pack.market.name) return clean({ '@type': 'AdministrativeArea', name: pack.market.name, containedInPlace: st ? { '@type': 'State', name: STATE[st] || st } : undefined });
  return undefined;
}
const entities = text => ENTITIES.filter(([re]) => re.test(text)).slice(0, 4).map(([, name, url]) => ({ '@type': 'Thing', name, sameAs: url }));

/* the graph for one page. o: {doc, brand, pack, type, url, slug, date, allow} */
export function buildSchema(o) {
  const { doc, brand, pack } = o, m = doc.meta || {}, base = baseOf(brand), url = o.url, type = o.type || m.type || 'page', allow = new Set(o.allow || []);
  const org = business(brand, pack), lang = m.language || 'en-US', graph = [org];
  const angle = pack && (pack.angles || []).find(a => a.id === m.angle), topic = [m.keyword, angle && angle.label, doc.h1].filter(Boolean).join(' ');
  const published = iso(m.date || m.published || o.date), modified = iso(m.modified || m.updated || o.date || published), image = m.image ? abs(m.image, base) : '';
  const about = entities(topic);

  graph.push(clean({ '@type': 'WebSite', '@id': base + '/#website', url: base + '/', name: brand.name, inLanguage: lang, publisher: { '@id': org['@id'] } }));

  /* breadcrumb: Home, the parent the front matter names (or the blog), the page */
  const crumbs = [{ name: 'Home', url: base + '/' }];
  for (const c of Array.isArray(m.breadcrumbs) ? m.breadcrumbs : []) { const [name, u] = Array.isArray(c) ? c : [c.name, c.url]; if (name && u) crumbs.push({ name, url: abs(u, base) }); }
  crumbs.push({ name: doc.h1 || m.title, url });
  graph.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) });

  const main = type === 'landing' ? url + '#service' : url + '#article';
  graph.push(clean({
    '@type': 'WebPage', '@id': url + '#webpage', url, name: m.title || doc.h1, description: m.description, inLanguage: lang, isPartOf: { '@id': base + '/#website' },
    about: { '@id': main }, mainEntity: { '@id': main }, breadcrumb: { '@id': url + '#breadcrumb' }, primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
    datePublished: published, dateModified: modified, mentions: about,
    speakable: doc.lede.length ? { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.answer'] } : undefined,
  }));

  if (type === 'landing') {
    graph.push(clean({
      '@type': 'Service', '@id': main, name: doc.h1, serviceType: (angle && angle.label) || m.service || m.keyword, description: m.description, url, provider: { '@id': org['@id'] },
      areaServed: place(m.city, pack, brand), category: pack && pack.vertical, image, mainEntityOfPage: { '@id': url + '#webpage' },
      availableChannel: brand.phone ? { '@type': 'ServiceChannel', serviceUrl: url, servicePhone: { '@type': 'ContactPoint', telephone: brand.phone, contactType: 'customer service' } } : undefined,
    }));
  } else {
    const au = m.author, person = au ? (typeof au === 'string' ? { name: au } : au) : null;
    graph.push(clean({
      '@type': type === 'blog' ? 'BlogPosting' : 'Article', '@id': main, headline: doc.h1, description: m.description, image, datePublished: published, dateModified: modified,
      author: person ? { '@type': 'Person', name: person.name, url: person.url, jobTitle: person.jobTitle || person.credentials } : { '@id': org['@id'] },
      publisher: { '@id': org['@id'] }, mainEntityOfPage: { '@id': url + '#webpage' }, isPartOf: { '@id': base + '/#website' }, inLanguage: lang,
      articleSection: (angle && angle.label) || m.section, keywords: [m.keyword, ...(Array.isArray(m.secondary) ? m.secondary : [])].filter(Boolean).join(', '),
      wordCount: doc.words, about, isAccessibleForFree: true,
    }));
  }

  /* only when the request asked for them and the page shows them */
  if (allow.has('faq')) {
    const qa = [], B = doc.blocks; for (let i = 0; i < B.length; i++) if (/^h[2-6]$/.test(B[i].type) && /\?\s*$/.test(B[i].text)) { const a = []; for (let j = i + 1; j < B.length && !/^h[1-6]$/.test(B[j].type); j++) if (B[j].type === 'p') a.push(B[j].text); if (a.length) qa.push({ '@type': 'Question', name: B[i].text, acceptedAnswer: { '@type': 'Answer', text: a.join(' ') } }); }
    if (qa.length >= 2) graph.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: qa, isPartOf: { '@id': url + '#webpage' } });
  }
  if (allow.has('ordered-list')) {
    const steps = doc.blocks.filter(b => b.type === 'li' && b.list === 'ol').map((b, i) => ({ '@type': 'HowToStep', position: i + 1, text: b.text }));
    if (steps.length >= 2) graph.push({ '@type': 'HowTo', '@id': url + '#howto', name: doc.h1, step: steps });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/* ---------- validation ---------- */
const NEED = {
  WebPage: ['url', 'name'], WebSite: ['url', 'name'], Service: ['name', 'provider'], BlogPosting: ['headline', 'datePublished', 'author', 'publisher', 'mainEntityOfPage'], Article: ['headline', 'datePublished', 'author', 'publisher', 'mainEntityOfPage'],
  BreadcrumbList: ['itemListElement'], FAQPage: ['mainEntity'], HowTo: ['name', 'step'],
};
const WANT = { Service: ['areaServed', 'serviceType', 'description'], BlogPosting: ['image', 'dateModified', 'description'], Article: ['image', 'dateModified', 'description'], WebPage: ['description', 'speakable', 'breadcrumb'] };
const BUSINESS = ['name', 'url'], BUSINESS_WANT = ['telephone', 'address'];

/* {ok, errors, warnings} for a graph; pass the page it belongs to and the checks tie the two together */
export function validate(schema, { doc = null, url = '', allow = [] } = {}) {
  const E = [], W = [], al = new Set(allow);
  if (!schema || schema['@context'] !== 'https://schema.org') E.push('@context must be "https://schema.org"');
  const G = schema && schema['@graph']; if (!Array.isArray(G) || !G.length) { E.push('@graph is missing or empty'); return { ok: false, errors: E, warnings: W }; }
  const ids = new Map();
  for (const n of G) { if (!n['@type']) E.push('a node has no @type'); if (n['@id']) { if (ids.has(n['@id'])) E.push(`two nodes share the id ${n['@id']}`); ids.set(n['@id'], n); } }
  const walk = (v, path, top) => {
    if (typeof v === 'string') {
      if (!v.trim()) E.push(`${path} is empty`);
      if (/\{\{?\s*\w+\s*\}?\}|\[[A-Z][A-Za-z ]+\]|lorem ipsum|\bTODO\b|\bTBD\b/.test(v)) E.push(`${path} holds a placeholder: "${v.slice(0, 60)}"`);
      if (/(^|\.)(url|item|logo|image|sameAs|serviceUrl)$|@id$/.test(path.replace(/\[\d+\]/g, '')) && !/^https:\/\/[^\s/]+\.[^\s/]+/.test(v) && !/^http:\/\//.test(v)) E.push(`${path} is not an absolute URL: "${v.slice(0, 80)}"`);
      if (/date(Published|Modified)$/.test(path) && !/^\d{4}-\d{2}-\d{2}/.test(v)) E.push(`${path} is not an ISO date: "${v}"`);
      return;
    }
    if (v == null) { E.push(`${path} is null`); return; }
    if (Array.isArray(v)) { if (!v.length) E.push(`${path} is an empty list`); v.forEach((x, i) => walk(x, `${path}[${i}]`, false)); return; }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (!top && keys.length === 1 && keys[0] === '@id') { if (!ids.has(v['@id'])) E.push(`${path} points at ${v['@id']}, which is not in the graph`); return; }
      if (keys.some(k => k === 'aggregateRating' || k === 'review') && !al.has('rating')) E.push(`${path} carries a rating or review. Leave them out unless the page shows first party reviews and the request allows "rating".`);
      for (const k of keys) walk(v[k], path ? `${path}.${k}` : k, false);
    }
  };
  for (const n of G) {
    const t = [].concat(n['@type'] || [])[0] || '?', isBiz = String(n['@id'] || '').endsWith('#organization');
    for (const k of (isBiz ? BUSINESS : NEED[t]) || []) if (n[k] == null) E.push(`${t} is missing ${k}`);
    for (const k of (isBiz ? BUSINESS_WANT : WANT[t]) || []) if (n[k] == null) W.push(`${t} has no ${k}`);
    if (t === 'FAQPage' && !al.has('faq')) E.push('FAQPage in the graph, but the request did not ask for an FAQ');
    if ((t === 'BlogPosting' || t === 'Article') && n.headline && n.headline.length > 110) E.push(`${t} headline is ${n.headline.length} characters (110 at most)`);
    if (t === 'BreadcrumbList') (n.itemListElement || []).forEach((x, i) => { if (x.position !== i + 1 || !x.name || !x.item) E.push(`breadcrumb item ${i + 1} needs position, name and item`); });
    walk(n, t, true);
  }
  const page = G.find(n => n['@type'] === 'WebPage'), main = G.find(n => ['Service', 'BlogPosting', 'Article'].includes(n['@type']));
  if (!page) E.push('no WebPage node'); if (!main) E.push('no Service, BlogPosting or Article node: every page carries one');
  if (!G.some(n => String(n['@id'] || '').endsWith('#organization'))) E.push('no business node');
  if (doc && page) {
    if (url && page.url !== url) E.push(`WebPage url ${page.url} is not the page's own address ${url}`);
    if (doc.meta.description && page.description !== doc.meta.description) E.push('WebPage description differs from the meta description');
    const head = main && (main.headline || main.name); if (head && doc.h1 && head !== doc.h1) E.push(`the ${main['@type']} is named "${head}" but the page's h1 is "${doc.h1}"`);
    if (main && main.wordCount && Math.abs(main.wordCount - doc.words) > 5) W.push('wordCount is out of date');
    const faq = G.find(n => n['@type'] === 'FAQPage'), text = doc.blocks.map(b => b.text).join('\n');
    for (const q of (faq && faq.mainEntity) || []) if (!text.includes(q.name)) E.push(`FAQ question not on the page: "${q.name}"`);
  }
  return { ok: !E.length, errors: [...new Set(E)], warnings: [...new Set(W)] };
}

/* ---------- the same page as a FORGE blueprint, the Site Forge's own page format ---------- */
export function blueprint(o) {
  const { doc, brand, pack, schema } = o, m = doc.meta || {}, type = o.type || m.type || 'page', base = baseOf(brand), G = schema['@graph'];
  const sections = [{ type: 'hero', h1: doc.h1, cta: ['primary'], trust: true, layout: 'center', style: 'light' }];
  if (doc.lede.length) sections.push({ type: 'answer', heading: m.answer_heading || 'The short answer', body: doc.lede.join(' '), style: 'tint' });
  let cur = null; const B = doc.blocks, first = B.findIndex(b => b.type === 'h2');
  for (const b of first === -1 ? [] : B.slice(first)) {
    if (b.type === 'h2') { cur = { type: 'rich_text', heading: b.text, html: '', width: 'narrow' }; sections.push(cur); continue; }
    if (!cur) continue;
    if (b.type === 'p' || b.type === 'table') cur.html += `<p>${b.html}</p>`; else if (/^h[3-6]$/.test(b.type)) cur.html += `<h3>${b.html}</h3>`; else if (b.type === 'verbatim') cur.html += `<p><small>${b.html}</small></p>`; else if (b.type === 'li') cur.html += `<p>${b.html}</p>`; else if (b.type === 'quote') cur.html += `<blockquote><p>${b.html}</p></blockquote>`;
  }
  if (type === 'landing') { sections.push({ type: 'form', heading: m.form_heading || 'Request service', text: '', style: 'tint' }); sections.push({ type: 'cta_band', heading: m.cta_heading || doc.h1, text: '', cta: ['primary'], style: 'brand' }); }
  const c = brand.colors || {}, f = brand.fonts || {}, org = G.find(n => String(n['@id'] || '').endsWith('#organization')), svc = G.find(n => n['@type'] === 'Service');
  const extra = G.filter(n => n['@type'] === 'HowTo');          /* the Forge writes its own Article for an article page */
  const internal = doc.links.filter(l => l.href.startsWith('/') || l.href.startsWith(base)).map(l => ({ anchor: l.anchor, url: l.href }));
  const crumbs = (G.find(n => n['@type'] === 'BreadcrumbList') || { itemListElement: [] }).itemListElement.slice(0, -1).map(x => ({ name: x.name, url: x.item }));
  const au = m.author ? (typeof m.author === 'string' ? { name: m.author } : m.author) : null, page = G.find(n => n['@type'] === 'WebPage') || {};
  return {
    site: { url: base, name: brand.name, brand: { name: brand.name, primary: c.primary, accent: c.accent, dark: c.dark, logo_url: brand.logo, font_heading: f.display, font_body: f.body } },
    page: Object.assign({
      slug: o.slug, title: m.title || doc.h1, h1: doc.h1, meta_description: m.description || '', archetype: type === 'landing' ? (m.city ? 'location' : 'service') : 'article', post_type: type === 'blog' ? 'post' : 'page',
      language: m.language || 'en-US', template: 'default', noindex: false, canonical: o.url, summary: doc.lede[0] || '', breadcrumbs: crumbs, internal_links: internal,
      cta: { primary: { label: m.cta || 'Request service', url: '#contact', phone: brand.phone, phone_label: brand.phone ? 'Call ' + brand.phone : '' } },
      conversion: { trust: [brand.license ? `${brand.licenseLabel || 'Lic'} ${brand.license}` : '', brand.hours || ''].filter(Boolean) },
      entity: org, dates: { published: page.datePublished || '', modified: page.dateModified || '' },
    }, svc ? { service: Object.fromEntries(Object.entries(svc).filter(([k]) => !['@id', 'provider', 'mainEntityOfPage', 'url'].includes(k))) } : {}, au ? { author: { name: au.name, url: au.url, credentials: au.jobTitle || au.credentials } } : {}, extra.length ? { schema_extra: extra } : {}),
    sections, media: {},
  };
}
export { words };
