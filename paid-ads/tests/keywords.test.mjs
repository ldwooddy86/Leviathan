/* lib/keywords.mjs: what a search means, where a keyword belongs, what must stay out. */
import { ok, done } from '../../dashboard-link/tests/_t.mjs';
import { intent, INTENT, isLocal, SPANISH, badForm, MATCH, blocks, twinless, themesOf, check, describe } from '../lib/keywords.mjs';

/* ---- intent ---- */
const I = { 'emergency ac repair': 'emergency', 'same day furnace repair': 'emergency', '24 hour ac repair near me': 'emergency', 'ac not cooling': 'symptom', 'furnace blowing cold air': 'symptom', 'heater won\'t turn on': 'symptom', 'thermostat says heat but no heat': 'symptom',
  'furnace repair': 'service', 'ac replacement': 'service', 'heat pump installation plano': 'service', 'how much does a new ac cost': 'price', 'ac financing': 'price', 'furnace replacement cost': 'price', 'free ac estimate': 'price', 'can i finance a new ac': 'price', 'how much does it cost to run a heat pump': 'research', 'is a furnace tune up worth the cost': 'research',
  'how long does a furnace last': 'research', 'heat pump vs furnace': 'research', 'is it worth repairing a 15 year old ac': 'research', 'who repairs furnaces': 'research', 'can i replace my own furnace': 'research', 'where is the furnace filter': 'research', 'signs of a bad capacitor': 'research',
  'hvac technician jobs': 'hiring', 'hvac apprenticeship dallas': 'hiring', 'hvac salary texas': 'hiring' };
const wrong = Object.entries(I).filter(([k, v]) => intent(k) !== v).map(([k, v]) => `${k}: ${intent(k)}, not ${v}`);
ok(wrong.length === 0, `${Object.keys(I).length} searches read for intent: emergency, symptom, service, price, research, hiring`, wrong);
ok(intent('how long does same day service take') === 'research' && intent('EMERGENCY AC REPAIR') === 'emergency' && intent('') === 'service', 'a question about urgency is research; case does not matter');
ok(Object.keys(INTENT).join() === 'emergency,symptom,service,price,research,hiring' && Object.values(INTENT).every(x => x.label && x.bid && x.action && x.note), 'each intent says how to bid on it and what to ask for');
ok(isLocal('ac repair near me') && isLocal('ac repair {city}') && isLocal('ac repair plano', ['Plano']) && isLocal('reparación de aire cerca de mí') && !isLocal('ac repair') && !isLocal('ac repair planos', ['Plano']) && isLocal('hvac st. paul', ['St. Paul']), 'a local search: near me, a city placeholder, a market city as a whole word');

/* ---- form ---- */
ok(badForm('ac repair') === '' && /empty/.test(badForm('  ')) && /placeholder/.test(badForm('ac repair {city}')) && /character/.test(badForm('ac repair, plano')) && /character/.test(badForm('what is seer?')) && /80/.test(badForm('a'.repeat(81))) && /10 words/.test(badForm('a b c d e f g h i j k')) && /stray spaces/.test(badForm(' ac repair')) && /stray spaces/.test(badForm('ac  repair')) && badForm('24/7 ac repair') === '' && badForm("won't turn on") === '', 'a keyword that cannot run says why: empty, placeholder, a barred character, too long, too many words, stray spaces');
ok(MATCH.join() === 'exact,phrase,broad', 'the match types');

/* ---- negatives ---- */
ok(blocks('jobs', 'hvac jobs') && !blocks('job', 'hvac jobs') && blocks('space heater', 'best space heater repair') && !blocks('heater space', 'space heater') && !blocks('free', 'freeze protection') && !blocks('', 'x') && !blocks('a b c', 'a b') && blocks('DIY', 'diy furnace repair'), 'a negative stops a keyword when its words stand in it, whole and in order; it matches no close variant');
const tw = twinless(['jobs', 'job', 'salary', 'free', 'space heater', 'window units', 'diy', 'classes']);
ok(JSON.stringify(tw) === JSON.stringify([{ negative: 'salary', missing: 'salaries' }, { negative: 'space heater', missing: 'space heaters' }, { negative: 'window units', missing: 'window unit' }, { negative: 'classes', missing: 'class' }]), 'negatives with no singular or plural twin, for nouns searched in both numbers only', tw);
ok(themesOf(['ac repair', 'new ac install', 'ac tune up']).join() === 'repair,replacement,upkeep' && themesOf(['thermostat']).length === 0, 'the job a keyword is about');

/* ---- a campaign's keywords ---- */
const K = (text, match = 'phrase') => ({ text, match });
const has = (F, rule, sev, re) => F.some(f => f.rule === rule && (!sev || f.severity === sev) && (!re || re.test(f.message + ' ' + f.excerpt + ' ' + f.where)));
let F = check({ lang: 'en', negatives: ['jobs', 'space heater', 'salary'], adGroups: [
  { name: 'Empty', keywords: [] },
  { name: 'Form', keywords: [K('ac repair {city}'), K('AC Repair Plano'), K('ac repair', 'wide'), K('ac repair service', 'broad')] },
  { name: 'Furnace Core', keywords: [K('furnace repair', 'exact'), K('furnace repair'), K('space heater repair'), K('furnace technician jobs'), K('acme air furnace repair')], negatives: ['furnace repair', { text: 'technician' }] },
  { name: 'Furnace Other', keywords: [K('furnace repair', 'exact'), K('new furnace install'), K('how long does a furnace last')] },
] }, { competitors: ['Acme Air', 'Abc'], line: 'heat' });
ok(has(F, 'kw-none', 'error', /Empty/) && has(F, 'kw-form', 'error', /placeholder/) && has(F, 'kw-form', 'note', /lower case/) && has(F, 'kw-form', 'error', /"wide" is not exact/) && has(F, 'kw-broad', 'warn', /ac repair service/), 'form: an empty ad group, a placeholder, capitals, a match type that does not exist, broad match');
ok(has(F, 'kw-duplicate', 'error', /also in the ad group "Furnace Core"/) && F.filter(f => f.rule === 'kw-duplicate').length === 1, 'a keyword in two ad groups with the same match is an error once; the same keyword in exact and phrase is not');
ok(has(F, 'kw-blocked', 'error', /campaign negative "space heater"/) && has(F, 'kw-blocked', 'error', /campaign negative "jobs"/) && has(F, 'kw-blocked', 'error', /ad group negative "furnace repair"/) && has(F, 'kw-blocked', 'error', /ad group negative "technician"/), 'a negative that stops the campaign\'s own keyword, at either level');
ok(has(F, 'kw-intent', 'error', /job seeker/) && has(F, 'kw-competitor', 'warn', /Acme Air/) && !F.some(f => f.rule === 'kw-competitor' && /Abc/.test(f.message)), 'a job seeker\'s search off the recruiting line; a competitor\'s name in a keyword');
ok(has(F, 'kw-theme', 'note', /repair and replacement/) && has(F, 'kw-mixed', 'note', /how long does a furnace last/) && has(F, 'neg-twin', 'note', /salary \(add: salaries\)/), 'an ad group that mixes jobs, one that mixes research with buying, negatives without their twin');
F = check({ lang: 'en', negatives: [], adGroups: [{ name: 'Recruit', keywords: [K('hvac technician jobs')] }] }, { line: 'recruit' });
ok(F.length === 0, 'hiring searches are right on the recruiting line', F);
const es = { lang: 'es', adGroups: [{ name: 'Core', keywords: [K('furnace repair'), K('heating repair')] }] };
ok(has(check(es), 'kw-language', 'warn', /every keyword in it is English/) && !has(check({ lang: 'es', adGroups: [{ name: 'Core', keywords: [K('furnace repair'), K('reparación de calefacción')] }] }), 'kw-language') && !has(check(Object.assign({}, es, { lang: 'en' })), 'kw-language') && SPANISH.test('aire acondicionado') && !SPANISH.test('air conditioning') && SPANISH.test('plomero cerca de mí') && !SPANISH.test('climate control') && !SPANISH.test('hornos'), 'a Spanish campaign that bids only on English searches is called out');
F = check({ lang: 'en', negatives: ['diy'], adGroups: [{ name: 'Core', keywords: [K('furnace repair', 'exact'), K('furnace repair'), K('furnace repair near me')] }] }, { competitors: [], cities: ['Plano'], line: 'heat' });
ok(F.length === 0, 'a clean ad group draws nothing', F);

/* ---- Spanish searches ---- */
const IES = { 'reparación de calefacción': 'service', 'calefacción no prende': 'symptom', 'sin calefacción': 'symptom', 'calentón tira aire frío': 'symptom', 'reparación de calefacción urgente': 'emergency', 'técnico de calefacción 24 horas': 'emergency', 'cuánto cuesta una calefacción nueva': 'price', 'financiamiento de aire acondicionado': 'price', 'cómo saber si mi calentón es seguro': 'research', 'trabajos de técnico de aire': 'hiring' };
const wrongEs = Object.entries(IES).filter(([k, v]) => intent(k) !== v).map(([k, v]) => `${k}: ${intent(k)}, not ${v}`);
ok(wrongEs.length === 0, `${Object.keys(IES).length} Spanish searches read for intent as well`, wrongEs);

/* ---- the same words in two ad groups, and a negative said once ---- */
F = check({ lang: 'en', negatives: ['repair'], adGroups: [{ name: 'A', keywords: [K('furnace repair', 'exact'), K('furnace repair'), K('heater repair')] }, { name: 'B', keywords: [K('furnace repair', 'broad'), K('ac tune up')] }] }, { line: 'heat' });
ok(F.filter(f => f.rule === 'kw-split').length === 1 && has(F, 'kw-split', 'warn', /also in the ad group "A" under another match type/) && !has(F, 'kw-duplicate') && F.filter(f => f.rule === 'kw-blocked').length === 3, 'the same words under another match type in a second ad group are called out; a negative that stops a keyword is said once for the keyword, not once for each match type', F.filter(f => f.rule === 'kw-blocked').map(f => f.where + ':' + f.excerpt));

const D = describe({ core: ['furnace repair', 'emergency furnace repair'], questions: ['how long does a furnace last'], city: ['furnace repair {city}'] }, ['Plano']);
ok(D.length === 4 && D[0].kind === 'core' && D[0].intent === 'service' && !D[0].local && D[1].intent === 'emergency' && D[2].kind === 'questions' && D[2].intent === 'research' && D[3].kind === 'local' && D[3].local, 'a keyword set described: kind, intent, local');
done();
