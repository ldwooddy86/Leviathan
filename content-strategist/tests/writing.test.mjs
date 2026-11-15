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
ok(pv('R22 is no longer produced here.')[0] === 'is no longer produced' && pv("The unit wasn't installed right. It's built in a hurry.").length === 2, 'no longer, a negative contraction, it is built');
ok(pv('The coil is frozen by low airflow.').length === 1 && pv('We need speed. Indeed, a hundred red beds were needed.').join() === 'were needed', 'a by phrase turns a state into a passive; -ed nouns are not verbs');
ok(!pv('Our techs are certified by NATE. We are licensed by the state and insured. The company is family owned and operated. HVAC work is regulated by TDLR.').length, 'a credential is a state whoever granted it');
ok(!pv('New units are built for the new refrigerant. The system is sized to the house. It is built to last. This furnace is rated for cold weather.').length && pv('The house was built for a family by a local firm.').length === 1, 'what a thing is for is a state, until a by phrase names who did it');
const hint = t => (passives(t)[0] || {}).hint || '';
ok(/went up|date to/.test(hint('Most homes here were built in the 1990s.')) && /owners replace/.test(hint('A central system is typically replaced at 15 years.')) && /Lead with the cause/.test(hint('The fins were crushed last spring.')) && hint('The coil was cleaned.') === '', 'a passive comes with the plain active wording where one is known');

const STATES = ['The outdoor unit is covered in ice.', 'The outdoor coil is coated in frost.', 'The unit is iced over.', 'The thermostat is set to heat.', 'The breaker is tripped.', 'The compressor is seized.', 'The system is undercharged.', 'The drain line is plugged.', 'The fan motor is burned out.', 'The ductwork is sealed.', 'The contactor is pitted.', 'Our technicians are skilled at finding leaks.', 'We are equipped to repair every brand.', 'The cost is unrelated to the size of the house.', 'The result is unexpected.', 'Your system is sized for the house.', 'The unit is rated for cold weather.'];
ok(STATES.every(s => !pv(s).length), 'the shape a thing is in right now is a state, not a passive', STATES.filter(s => pv(s).length));
const DONE = ['The unit was not yet repaired.', 'The system has been thoroughly and carefully checked.', 'Repairs are best handled in the fall.', 'The old unit was torn out last spring.', 'The power was shut off at the breaker.', 'The unit was quickly and quietly swapped.', 'The coil was badly bent in the storm.', 'The unit was lost in shipping.', 'A tune up is recommended every spring.', 'The coil is frozen by low airflow.'];
ok(DONE.every(s => pv(s).length === 1), 'something done to a thing is a passive: in the past tense, through a chain of adverbs, or with its actor named', DONE.filter(s => pv(s).length !== 1));

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
const pack = loadPack('dfw'), brand = json('brand.json'), live = new Set(['example-air.test/ac-replacement', 'example-air.test/heating-repair', 'example-air.test/maintenance-plan', 'example-air.test/plano-hvac', 'example-air.test/contact', 'example-air.test/frisco-hvac']);
const good = lint(parseMarkdown(read('landing.md')), { pack, brand, live, url: 'https://www.example-air.test/ac-repair-plano-tx/' });
ok(good.ok && good.counts.error === 0 && good.counts.warn === 0 && good.stats.grade >= LIMITS.floor && good.stats.grade <= LIMITS.grade && good.stats.passive === 0, 'the fixture landing page passes clean, inside grade 6 to 9', good.findings.map(f => f.rule + ': ' + f.message));
const blog = lint(parseMarkdown(read('blog.md')), { pack, brand });
ok(blog.ok && blog.stats.grade <= LIMITS.grade, 'the fixture blog post passes', blog.findings.filter(f => f.severity === 'error').map(f => f.message));
const bad = lint(parseMarkdown(`---\ntype: landing\ntitle: AC Repair\ndescription: Short.\nkeyword: ac repair plano\n---\n# Cooling Help\n\n## Why us\n\nQuotes are provided up front — always. [Click here](https://www.example-air.test/nope/) or see [ac repair plano](https://www.example-air.test/ac-repair/).\n\n- One\n- Two\n\n## Final Thoughts\n\nGet $99 a month financing. We are the #1 best HVAC company and R22 is illegal now.\n`), { pack, brand, live, url: 'https://www.example-air.test/ac-repair-plano-tx/' });
const got = new Set(bad.findings.filter(f => f.severity === 'error').map(f => f.rule));
ok(!bad.ok && ['passive', 'dash', 'bullet-list', 'closer-heading', 'answer', 'keyword', 'anchor', 'dead-link', 'anchor-own-keyword', 'rule:REGZ1'].every(r => got.has(r)), 'a bad page fails on each rule it breaks', [...got]);
ok(bad.findings.some(f => f.rule === 'rule:SUP1' && f.severity === 'warn' && f.fix) && bad.findings.some(f => f.rule === 'rule:R22A') && bad.findings.some(f => f.rule === 'license'), 'the vertical\'s advertising rules fire with their cite and fix');
ok(lint(parseMarkdown('# T\n\n1. one\n2. two'), { allow: ['ordered-list', 'title', 'description', 'answer', 'internal-links'] }).ok && !lint(parseMarkdown('# T\n\n1. one\n2. two'), { allow: ['title', 'description', 'answer', 'internal-links'] }).ok, 'a rule the request allows by name stops failing the gate');
const fm = (extra, body) => parseMarkdown(`---\ntype: landing\nvertical: dfw\ntitle: Heat Pump Repair in Frisco, TX | Example Air\ndescription: D\nkeyword: heat pump repair frisco\n${extra}\n---\n# Heat Pump Repair in Frisco, TX\n\n${body}\n`);
const friscoHp = pack.cities.find(c => c.name === 'Frisco').facts.find(f => /heat pumps/.test(f.label)).value;
const f1 = lint(fm('angle: heatpump\ncity: Frisco', `An estimated ${friscoHp} of Frisco central systems are heat pumps. We serve 4,000 homes and charge $89, and 61% of owners agree.`), { pack, brand }).findings;
ok(f1.some(f => f.rule === 'demand' && f.severity === 'warn' && /no demand trigger/.test(f.message) && /Heat pump share/.test(f.message)), 'an angle with no demand in the page\'s city draws a warning that gives the atlas\'s trigger');
const fig = f1.find(f => f.rule === 'figure');
ok(fig && fig.severity === 'warn' && /4,000/.test(fig.message) && /\$89/.test(fig.message) && /61%/.test(fig.message) && !fig.message.includes(friscoHp), 'figures the atlas does not vouch for are listed; the city\'s own facts are not', fig && fig.message);
const planoFig = t => lint(fm('angle: repair\ncity: Plano', t), { pack, brand }).findings.find(f => f.rule === 'figure');
ok(!planoFig('By one estimate about 120,000 systems cool Plano homes, about 23,000 of them 15 years old or more, and about 20% are that old. A new system runs about $13,000 on city permit records.') && /150,000/.test((planoFig('About 150,000 systems cool Plano homes and 97% are old.') || {}).message || '') && /97%/.test(planoFig('About 150,000 systems cool Plano homes and 97% are old.').message), 'a figure rounded the way a person says it is still backed; one that is simply different is not');

/* ---- the voice: talk to the homeowner ---- */
const vo = (body, o = {}) => lint(parseMarkdown(`---\ntype: landing\ntitle: T\ndescription: D\ncity: Plano\n---\n# AC Repair in Plano, TX\n\n${body}\n`), Object.assign({ brand }, o)).findings;
const has = (F, rule, sev) => F.some(f => f.rule === rule && (!sev || f.severity === sev));
ok(has(vo('That figure is a model estimate built from Census housing data.'), 'method-talk', 'error') && has(vo('A lifetime fit to the EIA survey puts it at 15 years.'), 'method-talk', 'error') && has(vo('The American Community Survey dates the typical home to 1993.'), 'method-talk', 'error') && !has(vo('Census figures put the typical home at 1993. Check the model number on the data plate. By one estimate, one in five systems is old.'), 'method-talk'), 'the machinery behind a number fails; the source in plain words passes, and so does a model number');
ok(has(vo('An estimated 20.2% of systems are old.'), 'figure-style', 'error') && has(vo('Owners replace an AC at 14.9 years.'), 'figure-style', 'warn') && has(vo('About 23,300 systems are old.'), 'figure-style', 'warn') && has(vo('About 20% are old, 48% heat with gas and 23% are heat pumps.'), 'figure-style', 'warn') && !has(vo('About one in five systems is old, and close to 23,000 are past 15 years. About half of homes heat with gas.'), 'figure-style'), 'a figure nobody would say aloud is caught: a decimal share, a decimal age, a count to the last hundred, a page of percentages');
const long = 'A weak capacitor stops the outdoor fan. A clogged drain line trips the safety switch. A slow leak lets the coil freeze. '.repeat(10);
ok(has(vo(long), 'address', 'warn') && !has(vo(long + 'You can check your filter first, and you should call when your coil ices over. Your system will tell you. You will hear it.'), 'address'), 'a page that never says you is told to talk to the owner');
ok(has(vo('Example Air repairs air conditioners in Plano. Call us.'), 'opens-on-us', 'warn') && has(vo('We repair air conditioners in Plano.'), 'opens-on-us') && !has(vo('When your house gets warm, you want it fixed. Example Air repairs air conditioners in Plano.'), 'opens-on-us'), 'a page that opens on the company is told to open on the reader');
ok(has(vo('Text.\n\n## What fails most\n\nA.\n\n## What a visit costs\n\nB.\n\n## Book a visit\n\nC.'), 'heading-place', 'warn') && !has(vo('Text.\n\n## AC repair in Plano\n\nA.\n\n## Furnace repair in Plano\n\nB.\n\n## Book a visit\n\nC.'), 'heading-place'), 'a city page whose sections never name the city is told to');
ok(lint(fm('angle: nosuchangle', 'Text.'), { pack, brand }).findings.some(f => f.rule === 'angle' && f.severity === 'error') && lint(fm('angle: heatpump\ncity: Atlantis', 'Text.'), { pack, brand }).findings.some(f => f.rule === 'city' && f.severity === 'warn') && !lint(fm('angle: repair\ncity: Frisco', 'Text.'), { pack, brand }).findings.some(f => ['demand', 'angle', 'city'].includes(f.rule)), 'an unknown angle fails; a city the pack does not know warns; a real pairing is quiet');
const sup = t => lint(fm('angle: heatpump', t), { pack, brand }).findings.some(f => f.rule === 'rule:SUP1');
ok(sup('We offer the best heat pump repair in Frisco.') && sup('We are the #1 team.') && !sup('The best time to replace a heat pump is spring.'), 'a superiority claim is caught; "the best time to" is not one');
ok(lint(fm('angle: heatpump', 'Ask us for a written estimate before you sign a contract.'), { pack, brand }).findings.some(f => f.rule === 'rule:TDLR2') && !lint(fm('angle: heatpump', 'Ask us for a written estimate.\n\n<!-- verbatim -->\nRegulated by The Texas Department of Licensing and Regulation, P.O. Box 12157.\n<!-- /verbatim -->'), { pack, brand }).findings.some(f => f.rule === 'rule:TDLR2'), 'a page that talks about estimates or contracts is asked for the TDLR notice until it carries it');
const post = lint(parseMarkdown('Heat pump repair in Frisco now has its own page on our site, with the parts that fail most and the signs that mean you should call. TDLR Lic TACLA00000E #Frisco #HeatPumpRepair'), { type: 'social', pack, brand });
ok(post.ok && post.stats.sentences === 1 && post.stats.grade > 6, 'a post\'s license tag and hashtags do not count as sentences', post.stats);

const over = lint(parseMarkdown('---\ntitle: T\ndescription: D\n---\n# T\n\n' + 'Comprehensive diagnostic evaluations necessitate considerable technical sophistication regarding refrigerant management. '.repeat(4)), {});
ok(over.findings.some(f => f.rule === 'reading-grade' && f.severity === 'error' && f.excerpt.includes('grade')), 'copy above grade 9 fails and names the sentences to fix');
ok(lint(parseMarkdown('---\ntitle: X\ndescription: Y\nkeyword: ac repair plano\n---\n# AC Repair in Plano\n\nText.'), { avoid: [{ keyword: 'AC repair Plano', url: 'https://www.example-air.test/other/' }], url: 'https://www.example-air.test/new/' }).findings.some(f => f.rule === 'cannibalization'), 'a keyword another page holds fails the gate');
ok(report(bad, 'bad.md').startsWith('FAIL  bad.md') && report(good).startsWith('PASS'), 'the report leads with the verdict');

/* ---- the document model ---- */
const d = parseMarkdown(read('landing.md')), html = renderBody(d);
ok(d.meta.type === 'landing' && Array.isArray(d.meta.secondary) && d.meta.breadcrumbs[0][1] === '/plano-hvac/' && d.h1 === 'AC Repair in Plano, TX' && d.lede.length === 1 && d.links.length === 6, 'front matter, the h1, the lede and the links');
ok(html.includes('<h1>AC Repair in Plano, TX</h1>') && html.includes('<p class="answer forge-answer">When your house gets warm') && html.includes('<section id="what-breaks-most-often-in-plano-homes">') && html.includes('data-verbatim') && !html.includes('<ul>'), 'the body renders with the answer marked for the speakable selector');
const page = renderPage(d, { schema: { '@context': 'https://schema.org', '@graph': [] }, url: 'https://www.example-air.test/x/' }), back = parseHtml(page);
ok(back.meta.title === d.meta.title && back.meta.description === d.meta.description && back.meta.canonical === 'https://www.example-air.test/x/' && back.h1 === d.h1 && back.jsonld.length === 1 && back.links.length === 6 && back.blocks.some(b => b.type === 'verbatim'), 'a rendered page reads back the same through the HTML reader');
ok(tropes(parseHtml('<h1>T</h1><p>Fine.</p><ul><li>a</li></ul><h2>FAQs</h2>')).map(f => f.rule).sort().join() === 'bullet-list,faq', 'a live HTML page can be put through the same rules');
done();
