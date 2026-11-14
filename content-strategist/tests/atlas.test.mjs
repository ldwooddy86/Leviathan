/* lib/literal.mjs and lib/atlas.mjs: reading an atlas's literals without running them, the keyword harvest, the packs on
   disk. The deep pack is checked as committed; rebuilding it needs the atlas file, which is not in the repository. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, ROOT } from './_t.mjs';
import { matchClose, fields, record, plain, ownerOf, declared } from '../lib/literal.mjs';
import { harvest, anglesFrom, negatives, trigger, consolePayloads, registry, listPacks, loadPack, withheld, scrub, isThermalDebt, deepPack } from '../lib/atlas.mjs';

/* ---- the literal reader ---- */
const src = `const ANGLES = [
  { id: 'repair', label: 'AC repair', path: '/ac-repair', trig: z => z.a >= 19 || (z.b || 0) > 2, why: 'Core; it\\'s every ZIP.',
    kw: ['ac repair', 'ac repair {city}', "air conditioner's fix"], kwq: ['why is my ac warm'], re: /[{'"]+/g, tpl: \`x \${ {a: 1}.a } y\`, // a comment with } in it
    es: { h: ['Reparación'], kw: ['reparación de aire'] }, n: 4, on: true },
  { id: 'heat', label: "Heating", kw: ['heater repair'], kwEs: ['calefacción'], neg: ['space heater'] },
];
const NEG_CUSTOMER = ['jobs', 'diy'];`;
const open = declared(src, 'ANGLES'), close = matchClose(src, open);
ok(src[open] === '[' && src.slice(close, close + 2) === '];', 'a declared literal is found and closed past strings, a regex, a template and a comment');
const first = src.indexOf('{', open), r = record(src, first, ['trig']);
ok(r.id === 'repair' && r.path === '/ac-repair' && r.n === 4 && r.on === true && r.kw.length === 3 && r.kw[2] === "air conditioner's fix" && r.why === "Core; it's every ZIP.", 'a record reads strings, numbers, booleans and string lists', r.why);
ok(r.trig === 'z => z.a >= 19 || (z.b || 0) > 2' && !('re' in r) && !('es' in r), 'a function comes back as text only when asked for; a regex and an object are left out');
ok(fields(src, first).map(f => f.key).join() === 'id,label,path,trig,why,kw,kwq,re,tpl,es,n,on', 'every key of an object, in order');
ok(ownerOf(src, src.indexOf('kwq:')) === first && ownerOf(src, src.indexOf("kw: ['reparación")) === src.indexOf('{ h:'), 'the object that holds a key, placeholders in strings not counted');
ok(plain('[["a b","phrase"],["c","exact"]]', 0, 31).length === 2 && plain('{"a":1}', 0, 7) === undefined, 'plain values only');

/* ---- triggers ---- */
const t = trigger('z => z.a >= 19 || (z.b || 0) > 2', {});
ok(t({ a: 20 }) && t({ a: 1, b: 3 }) && !t({ a: 1 }), 'a comparison trigger runs');
ok(trigger('z => (z.inc || 0) < MED.inc && Math.max(z.a, 1) > 0', { inc: 5 })({ inc: 1, a: 2 }) === true, 'MED and Math are in reach');
ok(trigger('z => process.exit(1)', {}) === null && trigger('z => require("fs")', {}) === null && trigger('z => { while (true) {} }', {}) === null && trigger('() => 1', {}) === null && trigger('z => globalThis.x', {}) === null, 'anything else is refused before it runs');

/* ---- the harvest ---- */
const A = anglesFrom(harvest(src));
ok(A.length === 2 && A[0].id === 'repair' && A[0].keywords.core.join('|') === "ac repair|ac repair {city}|air conditioner's fix" && A[0].keywords.questions[0] === 'why is my ac warm', 'core and question terms by angle', A.map(a => a.id));
ok(A[0].keywords.spanish.join() === 'reparación de aire' && A[1].keywords.spanish.join() === 'calefacción' && A[1].keywords.negatives.join() === 'space heater', 'a language block is filed under its angle; kwEs and neg are named');
ok(negatives(src).NEG_CUSTOMER.join() === 'jobs,diy', 'top level negative lists');
const shell = `const CR={ 1:{path:'/eye-exam', kw:{en:[['eye exam near me','phrase'],['[eye exam {city}]','exact']], es:[['examen de la vista','phrase']]}} };`;
const O = anglesFrom(harvest(shell));
ok(O.length === 1 && O[0].label === 'Eye exam' && O[0].keywords.core.join('|') === 'eye exam near me|eye exam {city}' && O[0].keywords.spanish.length === 1, 'match type pairs and a nameless owner take their name from the path', O[0]);
ok(anglesFrom(harvest(`x = {"id":"dwi","label":"DWI","kw":["dwi lawyer","dui lawyer"],"kwEs":["abogado de dwi"],"neg":["dwi class"]}`))[0].keywords.core.length === 2, 'JSON spelled lists read the same');

/* ---- the console and the packs on disk ---- */
const reg = registry(), P = consolePayloads(), idx = listPacks();
const industry = reg.modules.filter(m => m.wing !== 'core').map(m => m.id);
ok(industry.length === 14 && P.length >= 16, 'the console carries fourteen industry atlases', P.map(p => p.id).join(' '));
ok(industry.every(id => idx.packs.some(p => p.id === id)), 'every one has a pack', idx.packs.map(p => p.id).join(' '));
for (const id of industry) { const p = loadPack(id); ok(p.angles.length >= 9 && p.angles.every(a => a.id && a.label && Object.values(a.keywords).some(v => v.length)) && p.vertical && p.wing, `${id}: ${p.angles.length} angles, each with a label and keywords`); }
const live = anglesFrom(harvest(P.find(p => p.id === 'plumbing').text)), onDisk = loadPack('plumbing');
ok(JSON.stringify(live.map(a => [a.id, a.keywords])) === JSON.stringify(onDisk.angles.map(a => [a.id, a.keywords])), 'a keyword pack on disk is in step with the console (rebuild with: cli.mjs harvest)');

/* ---- the deep pack ---- */
const D = loadPack('dfw');
ok(D.depth === 'deep' && D.angles.length >= 17 && D.cities.length >= 100 && D.market.counties.length === 12 && D.schemaType === 'HVACBusiness', 'the DFW pack is deep', `${D.angles.length} angles, ${D.cities.length} cities`);
const rep = D.angles.find(a => a.id === 'repair'), plano = D.cities.find(c => c.name === 'Plano');
ok(rep.keywords.core.includes('ac repair') && rep.keywords.city.every(k => k.includes('{city}')) && rep.keywords.questions.length >= 3 && rep.reach.zips === rep.reach.of && rep.page.slug === 'ac-repair', 'an angle carries core, city and question terms, its reach and its planned page');
ok(plano && plano.county === 'Collin' && plano.facts.length >= 6 && plano.facts.every(f => f.value && f.label && f.source && /^[A-D]$/.test(f.grade)) && plano.facts.some(f => f.estimate) && plano.angles[0].share === 100, 'a city carries sourced facts, estimates flagged, and its angles by demand');
ok(D.cities[0].demand.replacementsPerYear >= D.cities[5].demand.replacementsPerYear && D.market.facts.length >= 8, 'cities rank by modeled demand; the market has its own facts');
ok(D.compliance.licenseInEveryAsset && D.compliance.notice.includes('Texas Department of Licensing') && D.compliance.rules.length >= 15 && D.compliance.rules.filter(r => r.test).every(r => { try { new RegExp(r.test.pattern, 'i'); return true; } catch { return false; } }), 'the advertising rules come with their cites, and each test pattern compiles');
ok(D.sitePlan.service.length >= 10 && D.sitePlan.guides.length >= 5 && !D.compliance.rules.some(r => r.enforcer === 'House style'), 'the Site Forge plan is carried; house style rules are not');
ok(!('brand' in D) && !JSON.stringify(D).includes('"phone"'), 'no brand in a pack');

/* ---- nothing withheld ---- */
const find = await withheld();
ok(typeof find === 'function', 'the console\'s withheld list is in reach');
for (const p of idx.packs) ok(!find(fs.readFileSync(path.join(ROOT, 'verticals', p.id + '.json'), 'utf8'), 1).length, `${p.id}: no withheld name`);
const s = await scrub({ a: 'fine', b: ['keep', Buffer.from('dG9wIHNoZWxmIGxvZ2lj', 'base64').toString() + ' house style'], c: { d: 'x' } });
ok(s.dropped === 1 && s.value.b.length === 1 && s.value.c.d === 'x', 'a string that carries a withheld name is dropped on the way to a pack');
ok(!isThermalDebt('<html>window.__ATLAS_DATA__ = {}</html>') && (() => { try { deepPack('<html></html>'); return false; } catch { return true; } })(), 'a file that is not a Thermal Debt atlas is refused');
done();
