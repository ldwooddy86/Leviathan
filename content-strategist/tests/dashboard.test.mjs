/* The content strategist and the dashboard: connect, what is connected, and the pages file for the Publish module.
   Everything runs in a sandbox (its own home and pack folders), with no browser: the running dashboard is covered by
   dashboard-link/tests/e2e. */
import fs from 'node:fs';
import path from 'node:path';
import { ok, done, FX } from './_t.mjs';
import { atlasFile, sandbox, run, gitState, REPO } from '../../dashboard-link/tests/_t.mjs';
import { isBundle, embeddedData, stripPanel } from '../../dashboard-link/lib/panel.mjs';

const CLI = 'content-strategist/cli.mjs', before = gitState();
const { home, env } = sandbox(), file = atlasFile();
const at = (...p) => path.join(home, ...p), J = f => JSON.parse(fs.readFileSync(f, 'utf8')), go = (args, o, e = env) => run(CLI, args, e, o);

/* ---- before a dashboard is connected ---- */
let r = go(['where']);
ok(r.code === 0 && /^Dashboard: none connected\. Ask for the dashboard file and run: connect <atlas\.html>/.test(r.out) && r.out.includes(at('content-strategist')), 'where, with nothing connected: says so and says how');
r = go(['dashboard']); ok(r.code === 0 && /No dashboard is connected on this machine/.test(r.out), 'dashboard says the same');
r = go(['handoff']); ok(r.code === 2 && /No built pages to hand over\. A page is built with: build <page\.md>/.test(r.err), 'handoff with nothing built says what to do first');
const junk = at('page.html'); fs.writeFileSync(junk, '<html></html>');
ok(go(['connect', junk]).code === 2 && /not a Thermal Debt atlas/.test(go(['connect', junk]).err) && go(['connect', at('missing.html')]).code === 2 && go(['connect']).code === 2, 'connect refuses a file that is not an atlas, or is not there');

/* ---- connect ---- */
r = go(['connect', file, '--no-live'], { json: true });
ok(r.code === 0 && r.json.id === 'dfw' && r.json.identity.build === '4' && r.json.packs.content.written && r.json.packs.paid.written && r.json.capabilities.content.find(c => c.what.startsWith('Publish takes a pages file')).ok && r.json.capabilities.content.find(c => c.what.startsWith('Deep pack')).ok && r.json.doors.some(d => d.id === 'publish.pages.in'), 'connect: one connection for both agents; this one gets its deep pack and the Publish door', r.err);
const pack = J(at('packs-content', 'dfw.json'));
ok(pack.depth === 'deep' && pack.id === 'dfw' && pack.angles.length >= 15 && pack.market && fs.existsSync(at('packs-paid', 'dfw.json')) && fs.existsSync(at('dashboard', 'connection.json')) && fs.existsSync(at('dashboard', 'atlas.html')), 'the deep pack is rebuilt from the dashboard, the paid ads specialist\'s pack is written beside it, and the connection is recorded outside the repository');
r = go(['extract', file, '--no-live'], { json: true }); ok(r.code === 0 && r.json.packs.content.written === false && r.json.packs.paid.written === false, 'extract, the older name, is the same command; the same file again rewrites no pack');
const bf = at('content-strategist', 'brand.json');
ok(J(bf).vertical === 'dfw' && J(bf).name === 'Your HVAC Company' && J(bf).offer && J(bf).proof && r.json.brandFile === bf, 'connect writes the brand the dashboard was built for, outside the repository, for both agents to read');
r = go(['connect', file, '--no-live'], undefined, Object.assign({}, env, { CS_BRAND: path.join(FX, 'brand.json') }));
ok(r.code === 2 && /The brand file's folder .* is inside the repository/.test(r.err) && JSON.parse(fs.readFileSync(path.join(FX, 'brand.json'), 'utf8')).name !== 'Your HVAC Company', 'connect will not write a client\'s brand over a file inside the repository');
fs.copyFileSync(path.join(FX, 'brand.json'), bf);   /* the console's atlas carries a placeholder brand: give the client a real one */
r = go(['where']); ok(/^Dashboard: DFW Thermal Debt Atlas · Build 4, connected \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\. It cannot be run on this machine/.test(r.out) && /Brand: Example Air/.test(r.out), 'where: the dashboard that is connected, and that it cannot be run here');
r = go(['dashboard']); ok(r.code === 0 && /Content strategist\n {2}ok Deep pack/.test(r.out) && /ok Publish takes a pages file: module 16, the import box/.test(r.out) && /in {3}Pages: a blueprint, a list of blueprints, or a complete HTML page {2}\(content\)/.test(r.out), 'dashboard: what this agent can do with it, and the door its pages go through');

/* ---- pages back to the dashboard ---- */
ok(go(['sitemap', path.join(FX, 'sitemap.xml')]).code === 0, 'the site is read');
r = go(['build', path.join(FX, 'landing.md'), '--date', '2026-11-14']);
ok(r.code === 0 && /For the dashboard: /.test(r.out) && /handoff/.test(r.out) && fs.existsSync(at('content-strategist', 'out', 'ac-repair-plano-tx', 'blueprint.json')), 'a page builds against the connected dashboard\'s pack, and the build says how it reaches the dashboard', r.err || r.out.slice(-300));
r = go(['build', path.join(FX, 'blog.md'), '--date', '2026-11-14']); ok(r.code === 0, 'and a second one', r.err || r.out.slice(-300));
r = go(['handoff', '--no-live'], { json: true });
const pf = at('content-strategist', 'out', 'pages-for-publish.json');
ok(r.code === 0 && r.json.file === pf && r.json.pages.length === 2 && r.json.pages.includes('ac-repair-plano-tx') && r.json.notTried === '--no-live was passed' && r.json.dashboard === null && fs.existsSync(pf), 'handoff: every built page in one file for the Publish module', r.err);
const P = J(pf);
ok(Array.isArray(P.pages) && P.pages.length === 2 && P.pages.every(b => b.page && b.page.slug && Array.isArray(b.sections)) && P.handoff.format === 'leviathan.handoff' && P.handoff.agent === 'content-strategist' && P.handoff.atlas.build === '4' && P.handoff.pages.length === 2, 'the file is a pages list of blueprints with a note on who made it and for which build');
/* the hand-off for the dashboard's Agent Desk, and the copy of the dashboard that holds it */
const hf = at('content-strategist', 'out', 'handoff.json'), hb = J(hf), deskCopy = at('dashboard', 'DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk.html');
ok(r.json.handoff === hf && isBundle(hb) && hb.id === 'content:pages' && hb.agent === 'content-strategist' && hb.atlas.build === '4' && hb.title === '2 pages' && JSON.stringify(hb.content.pages) === JSON.stringify(P.pages) && hb.content.checked.dashboard.ran === false && hb.content.checked.dashboard.why === '--no-live was passed',
  'handoff also writes handoff.json for the Agent Desk: the same blueprints, with who made them and that they were not tried on the running dashboard');
ok(hb.content.info.length === 2 && hb.content.info.every(i => i.slug && i.title && i.url && ['landing', 'blog'].includes(i.type) && i.keyword && i.words > 100 && i.grade > 0 && i.grade <= 9 && i.schemaTypes.length >= 3 && Array.isArray(i.warnings)), 'with what the gate measured for each page: its address, its keyword, its words and reading grade, its schema, the warnings left in');
ok(r.json.agentDesk.file === deskCopy && r.json.agentDesk.handoffs === 1 && r.json.agentDesk.opened === null && embeddedData(fs.readFileSync(deskCopy, 'utf8')).bundles[0].id === 'content:pages' && stripPanel(fs.readFileSync(deskCopy, 'utf8')) === fs.readFileSync(at('dashboard', 'atlas.html'), 'utf8') && fs.readFileSync(file, 'utf8') === fs.readFileSync(at('dashboard', 'atlas.html'), 'utf8'),
  'and writes the copy of the dashboard with the Agent Desk in it, holding these pages; the dashboard that was connected is not written to');
r = go(['handoff', 'ac-repair-plano-tx', '--no-live', '--out', at('one.json')]);
ok(r.code === 0 && /^1 page {2}-> /.test(r.out) && /^Hand-off {2}-> .*one\.handoff\.json$/m.test(r.out) && /For the dashboard: open .*DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk\.html and choose Agent Desk, the last module\. This page is on it, with what the gate measured, and one button sends it to Publish\./.test(r.out) && /nothing reaches a site until a person sends it/.test(r.out) && /That copy was not opened to check it: --no-live was passed\./.test(r.out) && /By hand instead: Publish \(module 16\), "What to publish", Import\. Drop .*one\.json on the box\./.test(r.out) && /Not tried on the running dashboard: --no-live was passed\./.test(r.out) && J(at('one.json')).pages.length === 1 && J(at('one.handoff.json')).id === 'content:ac-repair-plano-tx' && J(at('one.handoff.json')).title === 'AC Repair in Plano, TX',
  'one page by its slug: where it now is in the dashboard, the by hand route, a plain statement that neither was tried there, and a hand-off of its own that does not replace the whole set\'s');
r = go(['panel', '--no-live']);
ok(r.code === 0 && /2 hand-offs in it, newest first:/.test(r.out) && /content strategist\s+\S+ \S+ {2}AC Repair in Plano, TX {3}\(content:ac-repair-plano-tx\)/.test(r.out) && /\(content:pages\)/.test(r.out) && go(['panel', '--no-live', '--forget', 'content:ac-repair-plano-tx']).code === 0 && /No hand-off "content:nope" is on file/.test(go(['panel', '--forget', 'content:nope']).err), 'panel: the same command the link has, from the strategist\'s own command line, and a hand-off is forgotten by its id');
r = go(['handoff']); ok(r.code === 0 && /Not tried on the running dashboard: LEVIATHAN_NO_LIVE is set\./.test(r.out), 'with no browser on the machine, handoff still writes the file and says it was not tried');
ok(go(['handoff', 'no-such-page', '--no-live']).code === 2 && /No blueprint at/.test(go(['handoff', 'no-such-page', '--no-live']).err), 'a page that was never built cannot be handed over');
r = go(['check', pf]); ok(r.code === 3 && /no browser is available here/.test(r.err), 'check needs a browser, and says so');
ok(go(['help']).out.includes('handoff [slug | folder ...]') && go(['help']).out.includes('connect <atlas.html>') && go(['help']).out.includes('panel [--out file] [--forget id|all] [--no-live]'), 'help lists the dashboard commands');
ok(before !== null && gitState() === before && !fs.existsSync(path.join(REPO, 'content-strategist', 'out')), 'the repository is as it was: nothing a command wrote landed in it');
done();
