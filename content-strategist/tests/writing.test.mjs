/* The writing gate: reading grade, passive voice, the tropes, the page checks, the vertical's advertising rules. */
import { ok, done, read, json } from './_t.mjs';
import { parseMarkdown, parseHtml, renderBody, renderPage } from '../lib/doc.mjs';
import { sentences, words, syllables, grade } from '../lib/readability.mjs';
import { passives } from '../lib/passive.mjs';
import { tropes, phrases } from '../lib/tropes.mjs';
import { lint, report, LIMITS } from '../lib/lint.mjs';
import { loadPack } from '../lib/atlas.mjs';

/* ---- reading grade ---- */
const SY = { the: 1, home: 1, homes: 1, table: 2, replaced: 2, replacement: 3, installation: 4, heated: 2, services: 3, makes: 1, various: 3, material: 4, special: 2, actual: 3, quality: 3, period: 3, client: 2, convenient: 3, trying: 2, carrier: 3, video: 3, safely: 2, careful: 2, homeowner: 3, refrigerant: 4, conditioner: 4, capacitor: 4, system: 2, repair: 2, technician: 3, estimate: 3, furnace: 2, thermostat: 3, temperature: 4, humidity: 4, efficiency: 4, warranty: 3, maintenance: 3, emergency: 4, financing: 3, licensed: 2, approve: 2, common: 2, outdoor: 2, trouble: 2, simple: 2, people: 2, business: 2, schedule: 2, compressor: 3, diagnose: 3, energy: 3, electric: 3, money: 2, family: 3, summer: 2, question: 2, minute: 2, price: 1, written: 2, before: 2, visit: 2, older: 2, units: 2, builder: 2, failed: 1, started: 2, companies: 3, degrees: 2, insurance: 3, guarantee: 3, 'same-day': 2, 2026: 1 };
const miss = Object.entries(SY).filter(([w, n]) => syllables(w) !== n).map(([w, n]) => `${w}:${syllables(w)}!=${n}`);
ok(miss.length <= 2, `syllables: ${Object.keys(SY).length - miss.length} of ${Object.keys(SY).length} common words`, miss.join(' '));
const S = sentences('Dr. Lee works at 4180 Main St. in Plano, TX. The unit cost $1,250.50 in the U.S. last year! See example.com for more. "Is it old?" he asked.');
ok(S.length === 4, 'sentences split on ends, not on abbreviations, decimals or domains', S);
ok(words('A same-day fix costs $1,250.50, not 40%.').length === 7, 'a number and a hyphenated compound are one word each', words('A same-day fix costs $1,250.50, not 40%.'));
const easy = grade('The cat sat on the mat. The dog ran to the park. We like to play in the sun.'), hard = grade('Comprehensive diagnostic evaluations necessitate considerable technical sophistication, particularly regarding refrigerant management infrastructure and associated regulatory documentation requirements.');
ok(easy.grade < 2 && hard.grade > 18 && easy.ease > 90, 'Flesch-Kincaid puts a primer near grade 1 and jargon far past 12', [easy.grade, hard.grade]);

/* ---- passive voice ---- */
const pv = t => passives(t).map(p => p.phrase.toLowerCase());
ok(pv('The coil was cleaned last week.').length === 1 && pv('Quotes are always provided first.')[0] === 'are always provided' && pv('Your system has been serviced.').length === 1 && pv('The part got damaged in the storm.').length === 1 && pv('The duct was torn by a raccoon.').length === 1, 'be and get passives, with adverbs between');
ok(!pv('We clean the coil. Our techs are licensed and insured. The coil is frozen. The office is located in Plano. You are tired of the heat. We are done by noon. The fan is used to the load. It has stopped.').length, 'active voice and plain states pass');
ok(pv('Our techs are certified by NATE.').length === 1 && pv('We need speed. Indeed, a hundred red beds were needed.').join() === 'were needed', 'a by phrase turns a state into a passive; -ed nouns are not verbs');

/* ---- tropes ---- */
const rules = md => tropes(parseMarkdown(md)).map(f => f.rule);
ok(rules('# T\n\nA fix — fast.').includes('dash') && rules('# T\n\nOpen 9–5 daily.').includes('dash') && rules('# T\n\nA fix - fast.').includes('dash') && !rules('# T\n\nA same-day fix for a 15-year-old unit.').includes('dash'), 'em and en dashes and a spaced hyphen; a hyphenated word is not a dash');
ok(rules('# T\n\n- one\n- two').includes('bullet-list') && rules('# T\n\n1. one\n2. two').includes('ordered-list') && rules('# T\n\n• one').includes('bullet-list'), 'bullet and numbered lists');
ok(rules('# T\n\n## Frequently Asked Questions\n\nText.').includes('faq') && rules('# T\n\n## More\n\n### Why?\n\nA.\n\n### How?\n\nB.\n\n### When?\n\nC.').includes('faq') && !rules('# T\n\n## Why does a coil freeze?\n\nBecause.').includes('faq'), 'an FAQ block by its heading or by a run of question headings; one question heading is fine');
ok(rules('# T\n\n## Conclusion\n\nDone.').includes('closer-heading') && rules('# T\n\n**Fast:** yes.\n\n**Fair:** yes.').includes('bold-leadin') && rules('# T\n\nGreat work ✅').includes('emoji'), 'a wrap up heading, bolded lead ins, emoji');
const stock = ["In today's fast-paced world, comfort matters.", 'Let us delve into ducts.', "Whether you're a homeowner or a landlord, we help.", 'It is important to note that filters clog.', 'We are your one-stop shop for all your cooling needs.', 'This is more than just a repair.', 'Not only do we repair, but also we replace.', 'Nestled in the heart of Plano, we serve you.', 'Our robust, seamless process will elevate your comfort.'];
ok(stock.every(s => rules('# T\n\n' + s).includes('stock-phrase')), 'stock phrases', stock.filter(s => !rules('# T\n\n' + s).includes('stock-phrase')));
ok(!tropes(parseMarkdown('# AC Repair in Plano\n\nOur techs find the fault and show you the price. You decide before we start.\n\n## What fails most\n\nA weak capacitor stops the fan. We carry the part.')).length, 'plain copy raises nothing');
ok(rules('# T\n\n<!-- verbatim -->\nRegulated by the Department — P.O. Box 1.\n<!-- /verbatim -->').length === 0, 'a verbatim block (a legal notice) is exempt');
ok(phrases('AC Repair: The Ultimate Guide — 2026', 'title').map(f => f.rule).sort().join() === 'dash,stock-phrase' && rules('# T\n\nCertainly! Here is your draft.').includes('chat-leak') && rules('# T\n\nCall [City] today.').includes('placeholder'), 'titles are checked too; chat talk and placeholders are caught');

/* ---- the gate ---- */
const pack = loadPack('dfw'), brand = json('brand.json'), live = new Set(['example-air.test/ac-replacement', 'example-air.test/heating-repair', 'example-air.test/maintenance-plan', 'example-air.test/plano-hvac', 'example-air.test/contact']);
const good = lint(parseMarkdown(read('landing.md')), { pack, brand, live, url: 'https://www.example-air.test/ac-repair-plano-tx/' });
ok(good.ok && good.counts.error === 0 && good.counts.warn === 0 && good.stats.grade >= LIMITS.floor && good.stats.grade <= LIMITS.grade && good.stats.passive === 0, 'the fixture landing page passes clean, inside grade 7 to 9', good.findings.map(f => f.rule + ': ' + f.message));
const blog = lint(parseMarkdown(read('blog.md')), { pack, brand });
ok(blog.ok && blog.stats.grade <= LIMITS.grade, 'the fixture blog post passes', blog.findings.filter(f => f.severity === 'error').map(f => f.message));
const bad = lint(parseMarkdown(`---\ntype: landing\ntitle: AC Repair\ndescription: Short.\nkeyword: ac repair plano\n---\n# Cooling Help\n\n## Why us\n\nQuotes are provided up front — always. [Click here](https://www.example-air.test/nope/) or see [ac repair plano](https://www.example-air.test/ac-repair/).\n\n- One\n- Two\n\n## Final Thoughts\n\nGet $99 a month financing. We are the #1 best HVAC company and R22 is illegal now.\n`), { pack, brand, live, url: 'https://www.example-air.test/ac-repair-plano-tx/' });
const got = new Set(bad.findings.filter(f => f.severity === 'error').map(f => f.rule));
ok(!bad.ok && ['passive', 'dash', 'bullet-list', 'closer-heading', 'answer', 'keyword', 'anchor', 'dead-link', 'anchor-own-keyword', 'rule:REGZ1'].every(r => got.has(r)), 'a bad page fails on each rule it breaks', [...got]);
ok(bad.findings.some(f => f.rule === 'rule:SUP1' && f.severity === 'warn' && f.fix) && bad.findings.some(f => f.rule === 'rule:R22A') && bad.findings.some(f => f.rule === 'license'), 'the vertical\'s advertising rules fire with their cite and fix');
ok(lint(parseMarkdown('# T\n\n1. one\n2. two'), { allow: ['ordered-list', 'title', 'description', 'answer', 'internal-links'] }).ok && !lint(parseMarkdown('# T\n\n1. one\n2. two'), { allow: ['title', 'description', 'answer', 'internal-links'] }).ok, 'a rule the request allows by name stops failing the gate');
const over = lint(parseMarkdown('---\ntitle: T\ndescription: D\n---\n# T\n\n' + 'Comprehensive diagnostic evaluations necessitate considerable technical sophistication regarding refrigerant management. '.repeat(4)), {});
ok(over.findings.some(f => f.rule === 'reading-grade' && f.severity === 'error' && f.excerpt.includes('grade')), 'copy above grade 9 fails and names the sentences to fix');
ok(lint(parseMarkdown('---\ntitle: X\ndescription: Y\nkeyword: ac repair plano\n---\n# AC Repair in Plano\n\nText.'), { avoid: [{ keyword: 'AC repair Plano', url: 'https://www.example-air.test/other/' }], url: 'https://www.example-air.test/new/' }).findings.some(f => f.rule === 'cannibalization'), 'a keyword another page holds fails the gate');
ok(report(bad, 'bad.md').startsWith('FAIL  bad.md') && report(good).startsWith('PASS'), 'the report leads with the verdict');

/* ---- the document model ---- */
const d = parseMarkdown(read('landing.md')), html = renderBody(d);
ok(d.meta.type === 'landing' && Array.isArray(d.meta.secondary) && d.meta.breadcrumbs[0][1] === '/plano-hvac/' && d.h1 === 'AC Repair in Plano, TX' && d.lede.length === 1 && d.links.length === 5, 'front matter, the h1, the lede and the links');
ok(html.includes('<h1>AC Repair in Plano, TX</h1>') && html.includes('<p class="answer forge-answer">Need AC repair') && html.includes('<section id="what-breaks-most-often-in-plano-homes">') && html.includes('data-verbatim') && !html.includes('<ul>'), 'the body renders with the answer marked for the speakable selector');
const page = renderPage(d, { schema: { '@context': 'https://schema.org', '@graph': [] }, url: 'https://www.example-air.test/x/' }), back = parseHtml(page);
ok(back.meta.title === d.meta.title && back.meta.description === d.meta.description && back.meta.canonical === 'https://www.example-air.test/x/' && back.h1 === d.h1 && back.jsonld.length === 1 && back.links.length === 5 && back.blocks.some(b => b.type === 'verbatim'), 'a rendered page reads back the same through the HTML reader');
ok(tropes(parseHtml('<h1>T</h1><p>Fine.</p><ul><li>a</li></ul><h2>FAQs</h2>')).map(f => f.rule).sort().join() === 'bullet-list,faq', 'a live HTML page can be put through the same rules');
done();
