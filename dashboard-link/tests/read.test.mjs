/* lib/read.mjs: a dashboard read as text. Checked against the DFW atlas the console carries. */
import { ok, done, atlas } from './_t.mjs';
import { deep, literal, template, identity, titleClient, modules, doors, library, serviceLines, model, competitors, brandRaw, isThermalDebt, deskCode } from '../lib/read.mjs';
import { findWithheld } from '../../chrome-app/lib/scrub.mjs';

/* ---- literals ---- */
const src = `const A = { n: 1, s: 'two', list: ['a', "b"], inner: { deep: [1, { k: 'v' }], f: z => z.a > 1, t: \`x \${y} z\` }, fn() { return 1; }, last: true };
const T = { geo: \`\${N} of \${M} ZIPs, the \\\`rest\\\` by name\` };`;
const A = literal(src, 'A');
ok(A.n === 1 && A.s === 'two' && A.list.join() === 'a,b' && A.inner.deep[1].k === 'v' && A.last === true, 'a nested literal reads as data');
ok(!('f' in A.inner) && !('t' in A.inner) && !('fn' in A), 'a function, a template that interpolates and a method are left out');
ok(literal(src, 'A', ['f']).inner.f === 'z => z.a > 1', 'a key asked for raw comes back as source text');
ok(template(src, src.indexOf('`', src.indexOf('geo:')), { N: 257, M: 277 }) === '257 of 277 ZIPs, the `rest` by name' && template(src, src.indexOf('`', src.indexOf('geo:'))) === '… of … ZIPs, the `rest` by name', 'a template is filled from what is known; the rest becomes an ellipsis');
ok(literal(src, 'NOPE') === undefined && deep('x + 1', 0, 5) === undefined, 'what is not a literal is undefined');

/* ---- what the file is ---- */
const text = atlas(), id = identity(text, '/somewhere/atlas.html');
ok(isThermalDebt(text) && id.family === 'thermal-debt' && id.atlas === 'DFW Thermal Debt Atlas' && id.build === '4' && /^[0-9a-f]{64}$/.test(id.sha256) && id.zips === 277 && id.counties === 12 && id.name === 'atlas.html', 'identity: the atlas, its build, its size and its fingerprint', `${id.atlas} build ${id.build}`);
ok(titleClient(text) === '' && titleClient('<title>Some Client · DFW Thermal Debt Atlas · Build 6</title>') === 'Some Client' && !JSON.stringify(identity('<title>Some Client · DFW Thermal Debt Atlas · Build 6</title>')).includes('Some Client'), 'the client in a title is kept out of identity and read only when asked for');
const mods = modules(text);
ok(mods.length === 16 && mods[7].key === 'desk' && mods[7].num === '08' && mods[7].title === 'Campaign Desk' && mods.some(m => m.key === 'publish'), 'modules: key, number and title of each', mods.map(m => m.key).join(' '));

/* ---- its doors ---- */
const D = doors(text, mods), has = k => D.some(d => d.id === k);
ok(has('desk.plan.in') && has('desk.plan.out') && has('publish.pages.in') && has('forge.blueprint.in') && D.every(d => d.how && d.what && !('needs' in d)), 'doors: the Campaign Desk loads a plan, Publish takes pages, the Forge takes a blueprint', D.map(d => d.id).join(' '));
ok(doors(text, mods.filter(m => m.key !== 'publish')).every(d => d.module !== 'publish') && doors('nothing here', mods).length === 0, 'a door is listed only when its module and its code are both there');

/* ---- the paid library ---- */
const L = library(text), rep = L.angles.find(a => a.id === 'repair');
ok(L.angles.length >= 17 && rep.keywords.core.includes('ac repair') && rep.keywords.city.every(k => k.includes('{city}')) && rep.keywords.questions.length >= 3 && rep.copy.h.length >= 8 && rep.copy.d.length >= 3 && rep.copy.es.h.length >= 3 && rep.copy.social.primary.length > 40 && rep.trig === 'z => true' && rep.lsa.length > 0, 'an angle: keywords by kind, headlines, descriptions, Spanish, social copy, its trigger as text');
ok(L.lines.replace.angles.includes('replace') && L.lines.heat.objective === 'calls' && L.negatives.NEG_CUSTOMER.includes('jobs') && L.negatives.NEG_RECRUIT.length > 3, 'lines with their angles and objective; the negative lists');
ok(L.platforms.order.join() === 'google,lsa,dg,meta,microsoft,nextdoor,yelp,linkedin' && L.platforms.assumptions.google.basis === 'CPC' && L.platforms.assumptions.google.g === 'C' && L.platforms.mix.heat.google === 46 && L.platforms.book.google.limits.h === 30 && /\d+ of 277 ZIPs/.test(L.platforms.book.google.geo) && L.platforms.labels.dg === 'YouTube and Demand Gen', 'the platform book: order, labels, graded assumptions, mixes, limits, the interpolated line filled in', L.platforms.book.google.geo);
const DK = deskCode(text);
ok(DK && /^[0-9a-f]{12}$/.test(DK.code) && DK.bytes > 20000 && L.desk.code === DK.code && deskCode(text.replace(/registerModule\(\{\s*key:\s*'desk'/, m => '/* a change */ ' + m)).code !== DK.code && deskCode(text.replace(/<title>[^<]*<\/title>/, '<title>Another client</title>')).code === DK.code && deskCode('<html></html>') === null, 'the Campaign Desk\'s own code has a fingerprint: a change to the desk changes it, a change elsewhere in the file does not', DK);
ok(L.defaults.budget === 15000 && L.defaults.n === 30 && L.defaults.alpha === 1.2 && L.defaults.bookRate === 55 && L.defaults.jobVal === 3400, 'what a new plan opens with');
ok(L.rules.rules.length === 22 && L.rules.rules[0].id === 'TDLR1' && L.rules.rules[0].severity === 'block' && L.rules.rules[0].scope === 'asset' && L.rules.rules.every(r => /^[0-9a-f]{12}$/.test(r.test) && r.name && r.enforcer) && L.rules.notice.includes('Texas Department of Licensing') && L.rules.consent.includes('STOP') && L.rules.controls.length >= 5, 'the advertising rules, each with a fingerprint of its test; the notice and consent text');
const S = serviceLines(text), heat = S.lines.find(l => l.id === 'heat');
ok(S.lines.length === 14 && heat.desk === 'heat' && heat.economics.close === 68 && heat.fit.google === 3 && heat.hooks.length >= 3 && heat.triggers.length >= 2 && heat.negs.includes('space heater') && S.dayparts.emergency.weekday.length === 6 && S.blocks.length === 6 && S.assumptions.cpc === 9.68, 'the service lines: economics, platform fit, hooks, triggers, negatives, the hour of day templates');
ok(serviceLines('<html></html>') === null && (() => { try { library('<html></html>'); return false; } catch { return true; } })(), 'a file that is not a Thermal Debt atlas is refused');

/* ---- the model ---- */
const M = model(text, L), z = M.zips.find(x => x.zip === '75150');
ok(M.zips.length === 263 && M.all === 277 && M.counties.length === 12 && M.cities.length > 100 && M.triggersUnread.length === 0, 'the model: the scored ZIPs, the counties and cities', `${M.zips.length} of ${M.all}`);
ok(z && z.city === 'Mesquite' && z.county === 'Dallas' && /^\d{5}$/.test(z.fips) && z.tier === 'A' && z.bid === 30 && z.cpc_rel > 1 && z.effb > 50 && z.fires.includes('repair') && !('km_integrity' in z) && !z.fires.includes('recruit'), 'a ZIP: its place, the paid model fields, the angles it triggers', z && z.fires);
ok(M.zips.every(x => Array.isArray(x.fires) && x.fires.includes('repair')) && M.seasons.permits.length === 12 && M.seasons.hdd.length === 12, 'every ZIP triggers the core angle; the fallback seasons are carried');

/* ---- competitors and the brand ---- */
const C = competitors(text), B = brandRaw(text);
ok(C.companies.length > 200 && C.asOf && C.companies[0].reviews >= C.companies[5].reviews && C.companies.some(c => c.intel && c.intel.financing) && C.companies.every(c => c.key && c.name), 'the competitor roster, largest review base first, with website intel where the atlas has it', C.companies.length);
ok(B && B.city === 'Mesquite' && B.hours && typeof B.lat === 'number' && typeof B.colors === 'object', 'the brand the atlas was built for, nested fields included');
ok(!findWithheld(JSON.stringify([id, mods, D, L, M.counties, C.companies.slice(0, 40)]), 1).length, 'nothing read from the console\'s atlas carries a withheld name');
done();
