/* A source the copy names is a link the reader can open: the Census table for the place the sentence is about, the
   federal energy survey, the storm reports, the EPA rule. The link opens in another tab, and the gate fails a page that
   names a source and links nothing. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, done, ROOT, tmp, read } from './_t.mjs';
import { parseMarkdown, parseHtml, renderBody, renderPage, isOutside } from '../lib/doc.mjs';
import { lint } from '../lib/lint.mjs';
import { loadPack } from '../lib/atlas.mjs';
import { linkSources, linkHtml, censusUrl, topicOf, checkSources, loadPlaces, context } from '../lib/sources.mjs';
import { buildSchema, blueprint, pageUrl } from '../lib/schema.mjs';

const pack = loadPack('dfw'), SITE = 'https://www.example-air.test';
const HEAD = city => `---\ntype: landing\nvertical: dfw\ncity: ${city}\ntitle: T\ndescription: D\n---\n# Heating Repair in ${city}\n\n`;
const one = (city, body) => linkSources(HEAD(city) + body + '\n', { pack }), url = r => (r.linked[0] || {}).url || '';
const T = s => { const m = /Census figures/.exec(s); return (topicOf(s, m.index, m.index + m[0].length) || {}).table; };

/* ---- the address of a table ---- */
ok(censusUrl('B25040', { places: ['4858016'] }) === 'https://data.census.gov/table/ACSDT5Y2024.B25040?g=160XX00US4858016', 'a city: the table and the Census place');
ok(censusUrl('B25035', { places: ['4841212'], zips: ['75134', '75146'] }).endsWith('B25035?g=160XX00US4841212_860XX00US75134,75146') && censusUrl('B25034', { zips: ['75150'] }).endsWith('?g=860XX00US75150'), 'a city with ZIP codes beside it, and ZIP codes alone');
ok(censusUrl('B25040', { metro: '310XX00US19100' }).endsWith('?g=310XX00US19100') && censusUrl('B25040', {}) === '', 'the metro when there is no city; nothing when there is no place at all');
const PL = loadPlaces('dfw');
ok(PL && PL.places.Plano === '4858016' && PL.metro.geo === '310XX00US19100' && pack.cities.every(c => /^\d{7}$/.test(PL.places[c.name] || '')), 'every city in the pack has its Census place on file');
ok(context({ pack, city: 'savannah' }).city === 'Savannah' && context({ pack, city: 'Nowhere' }).city === '', 'a city is found whatever its case; an unincorporated place by its plain name; an unknown one is not made up');

/* ---- which table a sentence is about ---- */
ok(T('Census figures show about two in three Keller homes heat with natural gas.') === 'B25040' && T('About six in ten Melissa households rely on natural gas, according to Census figures.') === 'B25040' && T('When winter hits Plano, about half of homes switch on electric heat, by the count in Census figures.') === 'B25040', 'what homes heat with: the heating fuel table');
ok(T('Census figures put the typical Plano home at 1993.') === 'B25035' && T('The typical Plano home went up in 1993, which makes the town young by Census figures.') === 'B25035' && T('Going by Census figures, Plano homes are young, typically dating to 1993.') === 'B25035', 'the year of the typical home: the median year table, even when the sentence says "went up"');
ok(T('Close to half of Fate\'s homes went up in the 1990s, going by Census figures.') === 'B25034' && T('Census figures show about one in ten homes here went up in 2020 or later.') === 'B25034' && T('Plano has an older core. Census figures date about a third of homes there to before 1980.'.split('. ')[1]) === 'B25034', 'how many went up in which years: the year built table');
ok(T('About one in four owners here moved in since 2020, going by Census figures.') === 'B25038', 'when owners moved in: the tenure table');
ok(T('Census figures put the typical Rockwall home at 1999, and about one in three went up between 2000 and 2009.') === 'B25035' && T('More than a third of Balch Springs homes went up before 1980, going by Census figures, and the typical house in town dates to 1984.') === 'B25034' && T('About two in three Prosper homes heat with gas, Census figures show, and the typical home in town dates to 2012.') === 'B25040', 'a sentence with two claims links the one the source is attached to');

/* ---- the linker ---- */
let r = one('Plano', 'Census figures put the typical home here at 1993. By one estimate, about one in five Plano systems is 15 years old or more.');
ok(r.linked.length === 1 && url(r).endsWith('B25035?g=160XX00US4858016') && r.text.includes('[Census figures](https://data.census.gov/table/ACSDT5Y2024.B25035?g=160XX00US4858016) put the typical home') && !/\[by one estimate\]|\[By one estimate\]/.test(r.text), 'the page\'s own city; an estimate names no source and gets no link');
r = one('Lancaster', 'Census figures say about two in three Lancaster homes heat with electricity, in both 75134 and 75146.');
ok(url(r).endsWith('B25040?g=160XX00US4841212_860XX00US75134,75146') && r.linked[0].shows === 'Lancaster, ZIP 75134, ZIP 75146', 'ZIP codes the sentence names sit beside the city in the same table');
r = one('Keller', 'Census figures show about two in three Keller homes heat with natural gas, well above the share across Dallas Fort Worth.');
ok(url(r).endsWith('B25040?g=160XX00US4838632'), 'the metro\'s name is not read as the cities of Dallas and Fort Worth');
r = one('Highland Park', 'Gas is the main heat in town. Census figures show about six in ten Highland Park homes use it.');
ok(url(r).endsWith('B25040?g=160XX00US' + PL.places['Highland Park']), 'a sentence that leans on the one before it borrows its subject; Highland Park is not Highland Village');
r = linkSources('---\ntype: blog\nvertical: dfw\ntitle: T\ndescription: D\n---\n# T\n\nAcross the metro, Census figures show about six in ten homes heat with electricity.\n', { pack });
ok(url(r).endsWith('B25040?g=310XX00US19100') && /Metro Area/.test(r.linked[0].shows), 'a page with no city links the metro\'s table');
r = one('Plano', 'A Texas air conditioner lasts about 15 years, according to federal energy surveys. Around 75023, storm reports count about 22 falls of golf ball size hail. Under EPA rules, makers stopped producing R22 in 2020. Under EPA rules, new systems made since January 1, 2025 use A2L refrigerants such as R454B.');
ok(r.linked.map(x => x.source).sort().join() === 'epa,epa,recs,storm' && r.text.includes('[federal energy surveys](https://www.eia.gov/consumption/residential/data/2020/)') && r.text.includes('[storm reports](https://www.ncei.noaa.gov/access/storm-events-database/)') && r.text.includes('ods-phaseout/phaseout-class-ii-ozone-depleting-substances)') && r.text.includes('technology-transitions-hfc-restrictions-sector)'), 'the energy survey, the storm reports, and the EPA rule the sentence is about');
r = one('Plano', 'Census figures agree with us. See [our furnace page](https://www.example-air.test/gas-furnace/) too.');
ok(r.linked.length === 0 && r.open.length === 1 && /does not say what the figure is about/.test(r.open[0].why) && !r.changed, 'a sentence that does not say what the figure is stays unlinked and is reported; a web address in the line is not read as copy');
const twice = linkSources(one('Plano', 'Census figures put the typical home here at 1993.').text, { pack });
ok(twice.linked.length === 0 && twice.kept.length === 1 && !twice.changed, 'a source already linked is left as it is');
r = linkSources(HEAD('Plano') + '## What Census figures say\n\n```\nCensus figures put the typical home at 1993.\n```\n', { pack });
ok(r.linked.length === 0 && r.open.length === 0, 'headings and code are left alone');

/* ---- a link out of the site opens in another tab ---- */
const linked = one('Plano', 'Census figures put the typical home here at 1993. See [AC repair](/ac-repair/) and [our plan](https://www.example-air.test/plan/).').text, doc = parseMarkdown(linked, { site: SITE }), html = renderBody(doc);
ok(html.includes('<a href="https://data.census.gov/table/ACSDT5Y2024.B25035?g=160XX00US4858016" target="_blank" rel="noopener">Census figures</a>') && html.includes('<a href="/ac-repair/">AC repair</a>') && html.includes('<a href="https://www.example-air.test/plan/">our plan</a>'), 'the source opens in another tab; the site\'s own pages do not, whether written as a path or in full');
ok(isOutside('https://data.census.gov/x', SITE) && !isOutside('https://example-air.test/x', SITE) && !isOutside('/x/', SITE) && !isOutside('tel:+15555550100', SITE) && isOutside('https://www.example-air.test/x', ''), 'out of the site means a full web address on another host; with no site given, any full address');
const back = parseHtml(renderPage(doc, { url: SITE + '/x/' }));
ok(back.links.find(l => /census/.test(l.href)).newTab === true && back.links.find(l => l.href === '/ac-repair/').newTab === false, 'the HTML reader sees which links open in another tab');
const h = linkHtml('<p>Census figures show about half of homes in Plano heat with gas. See <a href="/heating-repair-allen-tx/">Allen</a>.</p><p>By one estimate, many are old.</p>', { pack, city: 'Plano' });
ok(h.linked.length === 1 && h.html.includes('<a href="https://data.census.gov/table/ACSDT5Y2024.B25040?g=160XX00US4858016" target="_blank" rel="noopener">Census figures</a> show') && h.html.includes('<a href="/heating-repair-allen-tx/">Allen</a>'), 'copy a page builder puts together as HTML gets the same link, new tab and all');
ok(linkHtml('<p>Census figures put about six in ten homes on it.</p>', { pack, city: 'Plano', topic: 'fuel' }).linked[0].title.startsWith('B25040') && linkHtml('<p>Census figures put about six in ten homes on it.</p>', { pack, city: 'Plano' }).open.length === 1, 'a builder that knows what the sentence states can name the table');

/* ---- the dashboard's blueprint: an opening that links a source keeps the link ---- */
const BRAND = JSON.parse(read('brand.json')), bpOf = md => { const d = parseMarkdown(md, { site: BRAND.url }), slug = d.meta.slug, u = pageUrl(d.meta, BRAND, slug); return blueprint({ doc: d, brand: BRAND, pack, schema: buildSchema({ doc: d, brand: BRAND, pack, type: 'landing', url: u, slug, date: '2026-11-18' }), type: 'landing', slug, url: u }); };
const plain = bpOf(read('landing.md')), opening = read('landing.md').replace('When your house gets warm on a July afternoon,', '[Census figures](https://data.census.gov/table/ACSDT5Y2024.B25035?g=160XX00US4858016) put the typical home here at 1993. When your house gets warm on a July afternoon,'), cited = bpOf(opening);
ok(plain.sections[1].type === 'answer' && typeof plain.sections[1].body === 'string' && JSON.stringify(plain).includes('target=\\"_blank\\" rel=\\"noopener\\">Census figures</a>'), 'a page whose opening links no source hands the dashboard its answer block as before, and the body keeps its source link');
ok(cited.sections[1].type === 'rich_text' && cited.sections[1].heading === plain.sections[1].heading && cited.sections[1].html.startsWith('<p class="forge-answer"><strong><a href="https://data.census.gov/table/ACSDT5Y2024.B25035?g=160XX00US4858016" target="_blank" rel="noopener">Census figures</a> put') && !cited.sections.some(x => x.type === 'answer'), 'an opening that links a source goes in as rich text, styled as the answer, because the Forge prints an answer block as plain text');

/* ---- the gate ---- */
const gate = body => lint(parseMarkdown(HEAD('Plano') + body + '\n', { site: SITE }), { pack, brand: { url: SITE } }).findings.filter(f => f.rule === 'source');
ok(gate('Census figures put the typical home here at 1993.').length === 1 && gate('Census figures put the typical home here at 1993.')[0].severity === 'error' && /sources <file> --write/.test(gate('Census figures put the typical home here at 1993.')[0].message), 'a named source with no link fails the gate, and the finding says how to fix it');
ok(gate('[Census figures](https://data.census.gov/table/ACSDT5Y2024.B25035?g=160XX00US4858016) put the typical home here at 1993.').length === 0 && gate('By one estimate, about one in five Plano systems is 15 years old or more.').length === 0, 'linked, it passes; an estimate is not a named source');
ok(gate('[Census figures](https://www.example-air.test/about/) put the typical home here at 1993.').length === 1 && gate('[Census figures](https://data.census.gov/table/ACSDT5Y2024.B25035?g=160XX00US4858016) put the typical home here at 1993, and Census figures show most heat with gas.').length === 1, 'a link to somewhere else does not count, and neither does one link for two mentions');
ok(checkSources(parseMarkdown('Federal energy surveys show a Texas air conditioner lasts about 15 years.')).length === 1 && lint(parseMarkdown('Storm reports show hail near you. TDLR Lic TACLA00000E'), { type: 'social', pack }).findings.every(f => f.rule !== 'source'), 'the rule reads a source at the head of a sentence; a social post carries no links and is not asked');
const live = lint(parseHtml('<h1>T</h1><p>See <a href="https://data.census.gov/x">Census figures</a> and <a href="https://www.eia.gov/y" target="_blank" rel="noopener">the survey</a> and <a href="/z/">ours</a>.</p>'), { brand: { url: SITE } }).findings.filter(f => f.rule === 'new-tab');
ok(live.length === 1 && /data\.census\.gov/.test(live[0].message) && live[0].severity === 'warn', 'a page that came as HTML is told which outside link opens in the same tab');

/* ---- the command ---- */
const dir = tmp('sources'), f = path.join(dir, 'page.md'); fs.writeFileSync(f, read('landing.md').replace(/\[Census figures\]\([^)]+\)/, 'Census figures'));
const run = (...a) => { const p = spawnSync(process.execPath, [path.join(ROOT, 'cli.mjs'), ...a], { encoding: 'utf8', env: Object.assign({}, process.env, { CS_BRAND_JSON: read('brand.json'), CS_HOME: dir }) }); return { code: p.status, out: p.stdout + p.stderr }; };
let c = run('sources', f);
ok(c.code === 0 && /would link\s+"Census figures" -> B25035, Median Year Structure Built for Plano/.test(c.out) && /add --write to save/.test(c.out) && !fs.readFileSync(f, 'utf8').includes('data.census.gov'), 'sources shows what it would link and writes nothing');
c = run('sources', f, '--write');
ok(c.code === 0 && /1 linked/.test(c.out) && fs.readFileSync(f, 'utf8') === read('landing.md'), 'with --write the page is saved with the link, and it is the page the fixture holds');
fs.writeFileSync(path.join(dir, 'open.md'), HEAD('Plano') + 'Census figures agree with us.\n');
c = run('sources', dir);
ok(c.code === 1 && /NOT LINKED\s+"Census figures"/.test(c.out) && /2 files/.test(c.out), 'a folder is read whole, and a mention the sentence does not settle fails the command');
done();
