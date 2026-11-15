/* lib/literal.mjs and lib/atlas.mjs: reading an atlas's literals without running them, the keyword harvest, the packs on
   disk. The deep pack is checked as committed; rebuilding it needs the atlas file, which is not in the repository. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, ROOT } from './_t.mjs';
import { matchClose, fields, record, plain, ownerOf, declared } from '../lib/literal.mjs';
import { harvest, anglesFrom, negatives, trigger, consolePayloads, registry, listPacks, loadPack, withheld, scrub, isThermalDebt, deepPack, readHeatmaps, NEEDS, miles } from '../lib/atlas.mjs';

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
ok(plano && plano.county === 'Collin' && plano.facts.length >= 7 && plano.facts.some(f => /heat pumps/.test(f.label)) && plano.facts.every(f => f.value && f.label && f.source && /^[A-D]$/.test(f.grade)) && plano.facts.some(f => f.estimate) && plano.angles[0].share === 100, 'a city carries sourced facts, estimates flagged, and its angles by demand');
ok(D.cities[0].demand.replacementsPerYear >= D.cities[5].demand.replacementsPerYear && D.market.facts.length >= 8, 'cities rank by modeled demand; the market has its own facts');
ok(D.compliance.licenseInEveryAsset && D.compliance.notice.includes('Texas Department of Licensing') && D.compliance.rules.length >= 15 && D.compliance.rules.filter(r => r.test).every(r => { try { new RegExp(r.test.pattern, 'i'); return true; } catch { return false; } }), 'the advertising rules come with their cites, and each test pattern compiles');
ok(D.sitePlan.service.length >= 10 && D.sitePlan.guides.length >= 5 && !D.compliance.rules.some(r => r.enforcer === 'House style'), 'the Site Forge plan is carried; house style rules are not');
ok(!('brand' in D) && !JSON.stringify(D).includes('"phone"'), 'no brand in a pack');

/* ---- the heatmaps: what each area needs ---- */
const LY = `const LAYERS = {\n ge15_sh: {l:'Central systems 15 years or older (%)', grp:'Thermal debt', g:'B', note:'Past the median life.'},\n yb_duct: {l:'Homes built 1980 to 1999 (%)', grp:'Housing stock', g:'A', note:'The flex duct generation.'},\n secret: {l:'Not a layer the pack uses', g:'A'},\n};`;
const rows = [...Array(8)].map((_, i) => ({ zip: '7500' + i, sys: 1000, ge15_sh: 10 + i, yb_duct: 20 + 5 * i, gas_sh: i === 7 ? 70 : 20, elec_sh: i === 7 ? 30 : 80, hail_recent: i === 0 ? 7 : 0, span_sh: 5 }));
const HM = readHeatmaps(LY, rows), z7 = HM.zips.get('75007'), z0 = HM.zips.get('75000');
ok(Object.keys(HM.layers).includes('ge15_sh') && HM.layers.yb_duct.label === 'Homes built 1980 to 1999 (%)' && HM.layers.yb_duct.note === 'The flex duct generation.' && !('secret' in HM.layers) && 'gas_sh' in HM.layers, 'the layer catalog is read as text: a layer the pack uses keeps its label and note, the rest are left out, and a column with no catalog entry still counts');
ok(z7.pct.ge15_sh > 90 && z0.pct.ge15_sh < 10 && z7.values.yb_duct === 55, 'each ZIP gets its percentile on a layer among the market\'s ZIPs');
ok(z7.needs.includes('aging-systems') && z7.needs.includes('flex-duct') && z7.needs.includes('gas-heat') && !z7.needs.includes('electric-heat') && z0.needs.includes('electric-heat') && z0.needs.includes('hail') && !z0.needs.includes('aging-systems'), 'a need is a layer running hot in a ZIP', [z7.needs, z0.needs]);
ok(NEEDS.every(n => n.id && n.title && n.tech && n.layers.length && typeof n.hot === 'function' && (n.copy === false ? !n.owner : n.owner.length > 60)) && NEEDS.filter(n => n.copy === false).map(n => n.id).join() === 'rentals,older-owners,spanish', 'every need says what to tell the owner and the trade detail behind it; who owns or rents a home, their age and their language are for planning only');
ok(Math.round(miles({ lat: 33.02, lon: -96.7 }, { lat: 33.15, lon: -96.82 })) === 11, 'miles between two cities');
ok(D.layers && Object.keys(D.layers).length >= 24 && typeof D.layers.ge15_sh.metro === 'number' && D.needs.length === NEEDS.length && D.needs.every(n => typeof n.metro === 'number' && !('hot' in n)), 'the DFW pack carries the heatmap layers with the market\'s level on each, and the needs with their reach', Object.keys(D.layers || {}).length);
ok(plano.areas.length === plano.zips.length && plano.areas.every(a => /^\d{5}$/.test(a.zip) && a.builtAround > 1900 && Array.isArray(a.needs) && typeof a.values.ge15_sh === 'number' && typeof a.heat.ge15_sh === 'number') && Math.abs(plano.areas.reduce((n, a) => n + a.share, 0) - 100) <= 4, 'a city carries each of its ZIPs: what runs hot there, the figures behind it and its share of the city\'s systems');
ok(plano.needs.length >= 5 && plano.needs.every(n => n.zips.length && n.share > 0 && n.share <= 100 && typeof n.citywide === 'boolean') && plano.needs.find(n => n.id === 'flex-duct').citywide && !plano.needs.some(n => n.id === 'new-homes'), 'and its needs in order, each with the ZIPs it belongs to: flexible duct across Plano, no new build story', plano.needs.map(n => n.id));
ok(plano.neighbors.length >= 4 && plano.neighbors[0].miles <= plano.neighbors[3].miles && plano.neighbors.some(n => n.name === 'Allen') && !plano.neighbors.some(n => n.name === 'Plano'), 'and the cities next door, nearest first', plano.neighbors);
ok(plano.facts.every(f => f.say && f.plainSource) && plano.facts.find(f => /15 years or older/.test(f.label)).say === 'about one in five' && D.market.facts.find(f => /central air conditioner/.test(f.label)).say === 'about 15 years' && D.market.facts.find(f => /central air conditioner/.test(f.label)).plainSource === 'federal energy surveys', 'every fact comes with how a person would say it and where it comes from in plain words');

/* ---- nothing withheld ---- */
const find = await withheld();
ok(typeof find === 'function', 'the console\'s withheld list is in reach');
for (const p of idx.packs) ok(!find(fs.readFileSync(path.join(ROOT, 'verticals', p.id + '.json'), 'utf8'), 1).length, `${p.id}: no withheld name`);
const s = await scrub({ a: 'fine', b: ['keep', Buffer.from('dG9wIHNoZWxmIGxvZ2lj', 'base64').toString() + ' house style'], c: { d: 'x' } });
ok(s.dropped === 1 && s.value.b.length === 1 && s.value.c.d === 'x', 'a string that carries a withheld name is dropped on the way to a pack');
ok(!isThermalDebt('<html>window.__ATLAS_DATA__ = {}</html>') && (() => { try { deepPack('<html></html>'); return false; } catch { return true; } })(), 'a file that is not a Thermal Debt atlas is refused');
done();
