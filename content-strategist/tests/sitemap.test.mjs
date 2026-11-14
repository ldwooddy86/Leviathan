/* lib/sitemap.mjs and lib/terms.mjs: reading a sitemap, what each URL stands for, cannibalization, internal links. */
import path from 'node:path';
import { ok, done, read, json, FX } from './_t.mjs';
import { parseSitemap, crawl, fromFile, inventory, deepen, cannibal, linkTargets, Blocked } from '../lib/sitemap.mjs';
import { tokens, key, covers, locate, places, angleOf } from '../lib/terms.mjs';
import { loadPack } from '../lib/atlas.mjs';

const pack = loadPack('dfw'), brand = json('brand.json'), P = places(pack, brand);

/* ---- terms ---- */
ok(key('Air Conditioner Repair near me') === key('ac repair') && key('A/C repairs') === key('ac repair') && key('AC replacement') !== key('ac repair'), 'phrases reduce to comparable stems');
ok(covers('AC Repair in Plano, TX | Example Air', 'ac repair plano') && !covers('Heating Repair in Plano', 'ac repair plano'), 'a keyword is covered when all its stems appear');
const l = locate('ac repair north richland hills tx', P);
ok(l.place === 'North Richland Hills' && l.kind === 'city' && locate('hvac in collin county', P).kind === 'county' && locate('dfw ac repair', P).kind === 'metro' && locate('ac repair', P).place === null, 'the place a phrase names: a city, a county, the metro, none', l);
ok(angleOf('ac repair', pack).id === 'repair' && angleOf('new ac unit', pack).id === 'replace' && angleOf('why is my ac blowing warm air', pack).kind === 'questions' && angleOf('mini split installation', pack).id === 'ductless' && angleOf('hvac', pack) === null && angleOf('pool cleaning', pack) === null, 'a topic lands on its service angle, or on none');
ok(tokens('heating and cooling services').join() === 'heat,cool,servic', 'filler words are dropped', tokens('heating and cooling services'));

/* ---- sitemaps ---- */
const idx = parseSitemap('<?xml version="1.0"?><sitemapindex><sitemap><loc>https://x.test/page-sitemap.xml</loc></sitemap><sitemap><loc><![CDATA[https://x.test/post-sitemap.xml]]></loc></sitemap></sitemapindex>');
ok(idx.kind === 'index' && idx.sitemaps.length === 2 && idx.sitemaps[1] === 'https://x.test/post-sitemap.xml', 'a sitemap index lists its children');
const us = parseSitemap(read('sitemap.xml'));
ok(us.kind === 'urlset' && us.urls.length === 23 && us.urls[0].lastmod === '2026-10-01', 'a urlset lists its URLs and dates');
ok(parseSitemap('Home | https://x.test/\nhttps://x.test/a/\n').urls.length === 2 && parseSitemap('<html>nope</html>').kind === 'none', 'a plain list of URLs reads too; a web page is not a sitemap');
const web = { 'https://x.test/robots.txt': 'User-agent: *\nSitemap: https://x.test/sitemap_index.xml\n', 'https://x.test/sitemap_index.xml': '<sitemapindex><sitemap><loc>https://x.test/page-sitemap.xml</loc></sitemap><sitemap><loc>https://x.test/post-sitemap.xml</loc></sitemap></sitemapindex>', 'https://x.test/page-sitemap.xml': '<urlset><url><loc>https://x.test/ac-repair/</loc></url><url><loc>https://x.test/</loc></url></urlset>', 'https://x.test/post-sitemap.xml': '<urlset><url><loc>https://x.test/why-is-my-ac-blowing-warm-air/</loc><lastmod>2026-01-02</lastmod></url></urlset>' };
const fetcher = async u => { if (!(u in web)) return { ok: false, status: 404, text: '', url: u }; return { ok: true, status: 200, text: web[u], url: u }; };
const c = await crawl('x.test', { fetcher });
ok(c.site === 'https://x.test' && c.urls.length === 3 && c.sitemaps.length === 3 && c.urls.find(u => u.loc.includes('warm-air')).source === 'post-sitemap.xml', 'a crawl follows robots.txt and the index to every URL', c.sitemaps.map(s => s.url));
const inv0 = inventory(c, { pack, brand });
ok(inv0.find(p => p.path === '/why-is-my-ac-blowing-warm-air/').kind === 'post' && inv0.find(p => p.path === '/').kind === 'home', 'a URL from the post sitemap is a post wherever it sits');
let threw = null; try { await crawl('blocked.test', { fetcher: async u => { throw new Blocked('blocked.test answered with a bot challenge (HTTP 202), not the page', { url: u, code: 'challenge' }); } }); } catch (e) { threw = e; }
ok(threw instanceof Blocked && threw.code === 'challenge', 'a bot challenge is reported as one, not as an empty site');
threw = null; try { await crawl('empty.test', { fetcher: async u => ({ ok: false, status: 404, text: '', url: u }) }); } catch (e) { threw = e; }
ok(threw instanceof Blocked && threw.code === 'none', 'a site with no sitemap says so');

/* ---- the inventory ---- */
const inv = inventory(fromFile(path.join(FX, 'sitemap.xml')), { pack, brand }), at = p => inv.find(x => x.path === p);
ok(inv.length === 23 && at('/ac-repair/').kind === 'service' && at('/ac-repair/').angle === 'repair' && at('/plano-hvac/').kind === 'location' && at('/plano-hvac/').place === 'Plano' && at('/ac-repair-frisco-tx/').kind === 'service-location' && at('/ac-repair-frisco-tx/').topic === 'ac repair', 'service pages, city pages and service in a city pages', inv.map(p => p.kind + ':' + p.path).join(' '));
ok(at('/blog/why-is-my-ac-blowing-warm-air/').kind === 'post' && at('/blog/why-is-my-ac-blowing-warm-air/').mode === 'answer' && at('/category/cooling/').kind === 'taxonomy' && at('/privacy-policy/').kind === 'legal' && at('/lp-ac-repair-plano/').kind === 'landing' && at('/contact/').kind === 'contact' && at('/').kind === 'home', 'posts, taxonomy, legal, campaign and contact pages');
const pages = { 'https://www.example-air.test/heat-pump/': '<html><head><title>Heat Pump Repair and Replacement | Example Air</title><meta name="robots" content="noindex,follow"></head><body><h1>Heat Pump Service</h1></body></html>' };
const inv2 = inventory(fromFile(path.join(FX, 'sitemap.xml')), { pack, brand }), dr = await deepen(inv2, { pack, brand, fetcher: async u => (u in pages ? { ok: true, status: 200, text: pages[u] } : { ok: false, status: 404, text: '' }) });
ok(dr.read === 1 && inv2.find(p => p.path === '/heat-pump/').h1 === 'Heat Pump Service' && inv2.find(p => p.path === '/heat-pump/').noindex === true, 'a deeper read takes each page\'s own title and h1 and sees noindex');

/* ---- cannibalization ---- */
let r = cannibal('ac repair frisco', inv, { pack, brand });
ok(r.verdict === 'conflict' && r.conflicts[0].url.endsWith('/ac-repair-frisco-tx/') && r.advice[0].startsWith('Do not write a new page'), 'the same service in the same city is a conflict', r.conflicts.map(c => c.url));
r = cannibal('air conditioning repair', inv, { pack, brand });
ok(r.verdict === 'conflict' && r.conflicts[0].url.endsWith('/ac-repair/'), 'a different wording of the same service is still a conflict', r.conflicts.map(c => c.why));
r = cannibal('ac repair plano', inv, { pack, brand });
ok(r.verdict === 'clear' && r.want.place === 'Plano' && r.want.angle === 'repair' && r.neighbors.some(n => n.relation === 'the parent service page' && n.url.endsWith('/ac-repair/')) && r.neighbors.some(n => /city page/.test(n.relation)) && r.avoid.some(a => a.keyword === 'AC repair') && !r.neighbors.some(n => n.url.includes('/lp-')), 'a new city for a service is clear, with the parent page and the city page as neighbors', r.neighbors.map(n => n.relation));
r = cannibal('why is my ac blowing warm air', inv, { pack, brand, type: 'blog' });
ok(r.verdict === 'conflict' && r.conflicts[0].url.includes('/blog/'), 'a post that answers the same question is a conflict');
r = cannibal('emergency ac repair', inv, { pack, brand, type: 'blog' });
ok(r.verdict === 'conflict' && /service page/.test(r.conflicts[0].why), 'a blog post may not aim at a service page\'s own term', r.conflicts.map(c => c.why));
r = cannibal('ac frozen coil', inv, { pack, brand, type: 'blog' });
ok(r.verdict === 'clear' && r.want.mode === 'answer' && r.neighbors[0].url.endsWith('/ac-repair/') && r.advice.some(a => a.includes('Link to')), 'a new question is clear and points at the service page it supports', r.advice);
r = cannibal('ac repair frisco', inv, { pack, brand, selfUrl: 'https://www.example-air.test/ac-repair-frisco-tx/' });
ok(r.verdict === 'conflict' && r.conflicts.every(c => !c.url.endsWith('/ac-repair-frisco-tx/')) || r.verdict === 'clear', 'a page never conflicts with itself');
r = cannibal('how long does an ac last in texas', [], { pack, brand, type: 'blog' });
ok(r.planned.some(p => p.guide === 'aclife'), 'a topic the Site Forge already plans is flagged', r.planned);
r = cannibal('r22 ac replacement', inv, { pack, brand });
ok(r.verdict === 'clear' && r.planned.some(p => p.slug === 'r22-ac-replacement') && r.neighbors.some(n => n.relation === 'a sister service' && n.url.endsWith('/ac-replacement/')), 'a service the atlas keeps apart is a sister page, and the page the Site Forge plans for it is named', r.planned);

r = cannibal('heat pump repair frisco', inv, { pack, brand });
ok(r.verdict === 'clear' && r.advice.some(a => /Slug: the site's city pages look like \/ac-repair-frisco-tx\//.test(a)) && r.advice.some(a => a.includes('"Heat Pump Service in Frisco"')), 'a city page is told the slug pattern the live site uses and the heading the Site Forge gives it', r.advice);

/* ---- internal links ---- */
let L = linkTargets('ac repair plano', inv, { pack, brand, n: 6 });
ok(L.targets[0].url.endsWith('/ac-repair/') && L.targets[0].why === 'the parent service page' && L.targets.some(t => t.url.endsWith('/plano-hvac/')) && L.targets.some(t => t.kind === 'contact'), 'the parent service page first, then the city page, with a next step', L.targets.map(t => t.url));
ok(!L.targets.some(t => /frisco|privacy|category|\/lp-/.test(t.url)) && new Set(L.targets.map(t => t.anchor.toLowerCase())).size === L.targets.length && L.targets.every(t => key(t.anchor) !== key('ac repair plano')), 'never another city, a legal, taxonomy or campaign page; anchors differ and none is the page\'s own keyword', L.targets.map(t => t.anchor));
L = linkTargets('heat pump repair frisco', inv, { pack, brand, n: 6 });
ok(L.targets[0].url.endsWith('/heat-pump/') && L.targets.some(t => t.url.endsWith('/heating-repair/')) && !L.targets.some(t => /ac-replacement|financing/.test(t.url)) && L.targets[L.targets.length - 1].kind === 'contact', 'a repair page is sent to repair pages, not to replacement and financing; the last link is the next step', L.targets.map(t => t.url.split('/').slice(-2)[0]));
L = linkTargets('ac repair frisco', inv, { pack, brand, selfUrl: 'https://www.example-air.test/ac-repair-frisco-tx/' });
ok(!L.targets.some(t => t.url.endsWith('/ac-repair-frisco-tx/')), 'a page is never its own link target');
L = linkTargets('ac frozen coil', inv, { pack, brand, type: 'blog' });
ok(L.targets[0].url.endsWith('/ac-repair/') && L.targets.some(t => t.url.includes('/blog/why-is-my-ac')), 'a post links to its service page and to a related post', L.targets.map(t => t.why));
done();
