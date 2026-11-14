/* cli.mjs end to end, as the agent drives it: read the site, check a keyword, build a page through the gate, check a post.
   Client files go to a scratch folder outside the repository, never under it. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, done, FX, ROOT, tmp } from './_t.mjs';

const local = tmp(), env = Object.assign({}, process.env, { CS_LOCAL: local, CS_OUT: path.join(local, 'out'), CS_BRAND: path.join(FX, 'brand.json'), HTTPS_PROXY: '', https_proxy: '', CS_BRAND_JSON: '' });
const run = (args, e = env) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'cli.mjs'), ...args], { encoding: 'utf8', env: e, timeout: 120000 }); return { code: r.status, out: r.stdout || '', err: r.stderr || '' }; };
const J = (args, e) => { const r = run([...args, '--json'], e); try { return Object.assign(r, { json: JSON.parse(r.out) }); } catch { return Object.assign(r, { json: null }); } };

/* ---- what the vertical knows ---- */
let r = J(['verticals']);
ok(r.code === 0 && r.json.packs.length >= 14 && r.json.packs.find(p => p.id === 'dfw').depth === 'deep', 'verticals lists a pack for every atlas');
r = J(['keywords', 'dfw', '--city', 'Plano']);
ok(r.code === 0 && r.json.city.name === 'Plano' && r.json.angles[0].demandShare === 100 && r.json.angles.find(a => a.id === 'repair').keywords.city.includes('ac repair Plano') && !JSON.stringify(r.json.angles).includes('{city}'), 'keywords for a city: its angles by demand, the city filled in');
r = J(['keywords', 'dental', '--find', 'implant']);
ok(r.code === 0 && r.json.angles.length >= 1 && r.json.angles[0].keywords.core.some(k => k.includes('implant')), 'keywords for another vertical, searched');
r = J(['market', 'dfw', '--city', 'Plano']);
ok(r.code === 0 && r.json.facts.some(f => f.estimate && /15 years or older/.test(f.label) && f.source) && r.json.market.length >= 8, 'market facts for a city, each with its source');
r = J(['keywords', 'dfw', '--city', 'Frisco', '--angle', 'heatpump']);
ok(r.code === 0 && r.json.angles.length === 1 && r.json.angles[0].demandShare === 0 && /NO demand trigger in Frisco/.test(run(['keywords', 'dfw', '--city', 'Frisco']).out), 'an angle with no demand in a city is still listed, and marked');
r = J(['market', 'dfw', '--city', 'Frisco']);
ok(r.json.facts.some(f => /heat pumps/.test(f.label) && f.estimate), 'a city\'s facts include its heat pump share');
r = J(['rules', 'dfw']);
ok(r.code === 0 && r.json.license.writeItAs === 'TDLR Lic TACLA00000E' && r.json.notice.includes('Texas Department of Licensing') && r.json.consent.includes('STOP') && r.json.rules.length >= 15 && run(['rules', 'dental']).code === 2, 'rules prints the license format, the notice, the consent text and each rule');
ok(run(['keywords', 'nope']).code === 2 && run(['market', 'dental']).code === 2 && run(['keywords', 'dfw', '--city', 'Atlantis']).code === 2, 'an unknown pack or city, or facts from a keyword pack, is an error with a reason');

/* ---- what the site has ---- */
ok(run(['cannibal', 'ac repair plano']).code === 2, 'no keyword check before the sitemap is read');
r = J(['sitemap', path.join(FX, 'sitemap.xml')]);
ok(r.code === 0 && r.json.pages === 23 && r.json.kinds.service === 8 && fs.existsSync(path.join(local, 'sitemap', 'example-air.test.json')), 'sitemap from a saved file builds the inventory', r.err || r.out.slice(0, 200));
r = J(['cannibal', 'ac repair frisco']);
ok(r.code === 1 && r.json.verdict === 'conflict', 'cannibal exits 1 on a conflict');
r = J(['cannibal', 'ac repair plano']);
ok(r.code === 0 && r.json.verdict === 'clear' && r.json.avoid.length >= 2, 'and 0 when the keyword is clear, with the keywords to leave alone');
r = J(['links', 'ac repair plano', '--n', '4']);
ok(r.code === 0 && r.json.targets.length === 4 && r.json.targets[0].url.endsWith('/ac-repair/'), 'links returns live targets with anchors');

/* ---- the gate ---- */
r = J(['build', path.join(FX, 'landing.md'), '--date', '2026-11-14']);
const dir = path.join(local, 'out', 'ac-repair-plano-tx');
ok(r.code === 0 && r.json.ok && r.json.url === 'https://www.example-air.test/ac-repair-plano-tx/' && ['page.md', 'page.html', 'body.html', 'schema.json', 'blueprint.json', 'report.json'].every(f => fs.existsSync(path.join(dir, f))), 'build writes the page, its schema, the blueprint and the report', r.err || r.out.slice(0, 300));
const html = fs.readFileSync(path.join(dir, 'page.html'), 'utf8'), schema = JSON.parse(fs.readFileSync(path.join(dir, 'schema.json'), 'utf8'));
ok(html.includes('<script type="application/ld+json">') && html.includes('"@type":"Service"') && html.includes('<h1>AC Repair in Plano, TX</h1>') && html.includes('rel="canonical" href="https://www.example-air.test/ac-repair-plano-tx/"') && schema['@graph'].length === 5, 'the page carries its schema in the head: no page leaves without it');
ok(run(['validate', path.join(dir, 'schema.json'), '--page', path.join(dir, 'page.md')]).code === 0 && run(['lint', path.join(dir, 'page.html')]).out.includes('grade'), 'the written schema validates against the page; the written HTML can be linted again');
r = J(['build', path.join(FX, 'blog.md'), '--date', '2026-11-14']);
ok(r.code === 0 && r.json.url === 'https://www.example-air.test/blog/ac-frozen-coil/' && r.json.schemaTypes.includes('BlogPosting'), 'a blog post lands under the site\'s blog path with BlogPosting schema', r.json && r.json.url);
const bad = path.join(local, 'bad.md');
fs.writeFileSync(bad, `---\ntype: landing\nvertical: dfw\nkeyword: ac repair frisco\nslug: ac-repair-frisco\ntitle: AC Repair in Frisco, TX | Example Air\ndescription: AC repair in Frisco from licensed technicians who show you the price before they start any work on your system today.\n---\n# AC Repair in Frisco, TX\n\nNeed AC repair in Frisco? Quotes are provided before work starts — always.\n\n## Why us\n\n- Fast\n- Fair\n\nSee [our team](https://www.example-air.test/not-a-page/).\n\n## Frequently Asked Questions\n\n### Is it fast?\n\nYes.\n`);
r = J(['build', bad]);
const rules = r.json ? new Set(r.json.report.findings.filter(f => f.severity === 'error').map(f => f.rule)) : new Set();
ok(r.code === 1 && r.json.ok === false && ['cannibalization', 'passive', 'dash', 'bullet-list', 'faq', 'dead-link'].every(x => rules.has(x)) && !fs.existsSync(path.join(local, 'out', 'ac-repair-frisco')), 'a page that breaks the rules is not written, and each broken rule is named', [...rules]);
ok(run(['build', path.join(FX, 'post.json')]).code === 2 && run(['build', path.join(FX, 'landing.md')], Object.assign({}, env, { CS_BRAND: path.join(local, 'none.json') })).code === 2, 'build needs a type, a keyword and a brand');
r = J(['build', path.join(FX, 'landing.md'), '--date', '2026-11-14'], Object.assign({}, env, { CS_BRAND: path.join(local, 'none.json'), CS_BRAND_JSON: fs.readFileSync(path.join(FX, 'brand.json'), 'utf8') }));
ok(r.code === 0 && r.json.ok, 'the brand can come from the environment instead of a file');

/* ---- social ---- */
r = J(['social', 'lint', path.join(FX, 'post.json')]);
ok(r.code === 0 && r.json.length === 2 && r.json.every(c => c.ok), 'social lint checks each platform');
r = J(['social', 'post', path.join(FX, 'post.json'), '--platform', 'all']);
ok(r.code === 0 && r.json.length === 2 && r.json.every(x => x.sent === false && x.request && /Dry run/.test(x.note)) && !fs.existsSync(path.join(local, 'social-ledger.jsonl')), 'social post without --confirm is a dry run on every platform');
ok(run(['social', 'post', path.join(FX, 'post.json')]).code === 2, 'social post needs a platform named');
const held = path.join(local, 'post-pending.json'); fs.writeFileSync(held, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(path.join(FX, 'post.json'), 'utf8')), { pending: true, link: 'https://www.example-air.test/not-live-yet/' })));
r = run(['social', 'post', held, '--platform', 'facebook', '--confirm']);
ok(/HELD  facebook/.test(r.out) && !fs.existsSync(path.join(local, 'social-ledger.jsonl')) && /PENDING/.test(run(['social', 'post', held, '--platform', 'facebook']).out), 'a pending post is held back at --confirm and marked in the dry run', r.out.slice(0, 160));
const noLic = path.join(local, 'post-bad.json'); fs.writeFileSync(noLic, JSON.stringify({ link: 'https://www.example-air.test/ac-repair/', facebook: { text: 'We fix it fast.' } }));
r = run(['social', 'post', noLic, '--platform', 'facebook', '--confirm']);
ok(r.code === 1 && /Not sent/.test(r.out) && /license/.test(r.out), 'a post that fails its checks is never sent, even with --confirm');

/* ---- where client files may live ---- */
r = run(['verticals'], Object.assign({}, env, { CS_LOCAL: path.join(ROOT, '.local') }));
ok(/inside the repository/.test(r.err) && !fs.existsSync(path.join(ROOT, '.local')), 'pointing client files into the repository draws a warning');
ok(run(['help']).out.includes('social post') && run(['nonsense']).code === 2, 'help lists the commands');
fs.rmSync(local, { recursive: true, force: true });
done();
