/* lib/satchel.mjs: the ported rule tests against the dashboard's own. The atlas's rule pack and its satchelLint are lifted
   out of the console's DFW atlas and run as they stand; the port must say the same thing, rule for rule, on every text. */
import vm from 'node:vm';
import { ok, done, atlas } from './_t.mjs';
import { library } from '../lib/read.mjs';
import { TESTS, drift, lint, lintSet } from '../lib/satchel.mjs';
import { matchClose } from '../../content-strategist/lib/literal.mjs';

const text = atlas(), lib = library(text), rules = lib.rules.rules;

/* ---- the port speaks for every rule this atlas has ---- */
ok(drift(rules).length === 0 && rules.every(r => TESTS[r.id] && TESTS[r.id].from === r.test), 'every rule of the atlas has a test here, written from the same source', drift(rules));
const changed = rules.map(r => (r.id === 'TAX1' ? Object.assign({}, r, { test: '000000000000' }) : r)).concat([{ id: 'NEW9', test: 'abc' }]);
ok(drift(changed).map(d => d.id).join() === 'TAX1,NEW9' && /changed/.test(drift(changed)[0].why) && /no test/.test(drift(changed)[1].why), 'a rule whose test changed, and a rule with no test, are both reported');

/* ---- the dashboard's own, run as it stands ---- */
const at = text.indexOf('const SAT = {'), fn = text.indexOf('function satchelLint', at), open = text.indexOf('{', text.indexOf(')', fn)), box = {};
vm.runInNewContext(text.slice(at, matchClose(text, open) + 1) + '\nthis.real = satchelLint;', box, { timeout: 5000 });
ok(typeof box.real === 'function', 'the atlas\'s rule pack and satchelLint run on their own');

const fill = s => s.replace(/\{city\}/g, 'Plano').replace(/\{county\}/g, 'Collin').replace(/\{brand\}/g, 'Example Air').replace(/\{lic\}/g, 'TACLA00000E').replace(/\{pay\}/g, '$26 to $42 an hour');
const corpus = [
  'AC Repair in Plano', 'Call Today!', 'BEST PRICES in town', 'Same Day AC Repair', 'Open 24/7 for emergencies', 'Lic TACLA00000E', 'TACL A 12345 C',
  'Claim your 30% federal tax credit today. Ask us how.', 'The federal tax credit ended with 2025 installs. Ask about utility rebates.', 'The 25C credit is no longer available.',
  '0% APR for 60 months on a new system', '$99 a month with approved credit', '$99 a month. APR 9.99%, terms and approval apply.', '12 monthly payments of $150', 'No interest if paid in 18 months',
  'Free estimate on system replacement', 'Lifetime warranty on every install', 'Satisfaction guaranteed. See terms.', '100% satisfaction guarantee',
  'The #1 HVAC company in Dallas', 'Best AC repair in Plano', 'Lowest price or we beat any price', 'Top rated by your neighbors', 'Most trusted name in cooling',
  '4.9 stars from 915 Google reviews', '900+ five star reviews', '5 star rated service', 'Only 3 spots left this week', 'Offer ends in 2 hours', 'Act now before the heat', 'Today only: tune up special',
  'R22 is now illegal so your unit must be replaced', 'Freon systems are banned to use in Texas', 'R22 has not been produced since 2020.',
  'We handle your insurance claim start to finish', 'We work directly with your insurance company', "We'll handle the claim", 'We waive your deductible', 'Your insurer decides coverage; we give you the documentation.',
  '18 SEER2 heat pumps installed', 'SEER rating of 16', 'AFUE 96 furnaces', 'ENERGY STAR certified systems', 'Licensed and insured techs', 'Licensed & Insured', 'NATE certified technicians', 'Factory authorized dealer', 'Bonded crews',
  'Around the clock service', 'Open 7 days a week', "We'll text you when the tech is on the way", "We'll text you updates. Reply STOP to opt out.",
  'Call (972) 555 0100 now', 'Call 972.555.0100', 'Call 972-555-0100', 'Bad credit? No problem', 'Are you struggling with your bills', 'Behind on bills this winter',
  'Financing options, subject to credit approval', 'Low monthly payment plans', 'A well-built system', 'Tune-up special', 'Tune up — book now', 'Heat pump repair 2020–2025', 'See https://example.com/tune-up for details', 'Email info@air-co.com',
  'Offer [insert here]', 'TBD headline', 'Serving {city} homes', 'Lorem ipsum dolor', 'Note to editor: fix this', 'placeholder text',
  'We send a proposal and a written estimate before work starts.', 'Our contract is regulated by the Texas Department of Licensing and Regulation.', 'HVAC TDLR NATE SEER', 'FURNACE Repair', 'New AC Units',
  'Furnace repair near you. Licensed techs. Lic TACLA00000E.', 'No heat? We price it before work starts and aim to fix it on the first visit.',
];
for (const a of lib.angles) for (const s of [...a.copy.h, ...a.copy.d, ...(a.copy.es ? [...a.copy.es.h, ...a.copy.es.d] : []), ...(a.copy.social ? Object.values(a.copy.social) : [])]) corpus.push(s, fill(s));
const ctxs = [{}, { lic: 'TACLA00000E' }, { lic: 'TACLA00000E', needLic: true }, { needLic: true }, { headline: true }, { platform: 'meta' }, { platform: 'meta', needLic: true, lic: 'TACLA00000E' }, { page: true }, { web: true }, { noHouse: true }];
const show = list => list.map(x => x.rule.id + '|' + x.ev);
let n = 0, bad = [], fired = new Set();
for (const t of corpus) for (const c of ctxs) { n++; const theirs = show(box.real(t, c)), mine = show(lint(t, c, rules)); theirs.forEach(x => fired.add(x.split('|')[0])); if (JSON.stringify(mine) !== JSON.stringify(theirs)) bad.push([t, c, mine, theirs]); }
ok(bad.length === 0, `${n} texts and contexts: the port says what the dashboard says, with the same evidence`, bad[0]);
ok(fired.size === rules.length, 'the corpus makes every one of the rules fire in the dashboard', rules.filter(r => !fired.has(r.id)).map(r => r.id));

/* ---- a set of ad texts, screened as the Campaign Desk screens one ---- */
const deskSet = (texts, plat, lic) => { const L = (txt, extra) => box.real(txt, Object.assign({ lic }, extra || {})); const f = L(texts.join(' \n '), { needLic: true, platform: plat }); texts.forEach(t => L(t, { headline: true }).forEach(x => { if (x.rule.id === 'GGL1') f.push(x); })); return show(f); };
const sets = [[['Call Now!', 'Great Deals', 'A description with one mark!'], 'google'], [['FURNACE Sale', 'Financing available'], 'meta'], [['Heating Repair in Plano', 'Licensed techs price it first. Lic TACLA00000E.'], 'google'], [['Heating Repair in Plano', 'No license here.'], 'google']];
for (const a of lib.angles) sets.push([[...a.copy.h, ...a.copy.d].map(fill), 'google'], [[...(a.copy.social ? Object.values(a.copy.social) : [])].map(fill), 'meta']);
const off = sets.filter(([t, p]) => JSON.stringify(show(lintSet(t, { lic: 'TACLA00000E', platform: p }, rules))) !== JSON.stringify(deskSet(t, p, 'TACLA00000E')));
ok(off.length === 0, `${sets.length} ad sets: lintSet matches the desk's own screen`, off[0]);
const s1 = lintSet(['Call Now!', 'Fine headline', 'No license in this one.'], { lic: 'TACLA00000E', platform: 'google' }, rules);
ok(s1.some(x => x.rule.id === 'TDLR1') && s1.some(x => x.rule.id === 'GGL1' && x.in === 'Call Now!') && !lintSet(['Fine', 'Licensed. Lic TACLA00000E.'], { lic: 'TACLA00000E' }, rules).length, 'a set with no license number and an exclamation mark draws both; a clean set draws nothing');
ok(lint('Financing available', { platform: 'meta' }, rules).some(x => x.rule.id === 'META2') && !lint('Financing available', { platform: 'google' }, rules).some(x => x.rule.id === 'META2') && lint('A well-built system', {}, rules).some(x => x.rule.id === 'HOUSE1') && !lint('A well-built system', { noHouse: true }, rules).length, 'a rule runs only where its scope says: Meta\'s on Meta, house style unless switched off');
done();
