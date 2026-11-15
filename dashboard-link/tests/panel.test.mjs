/* The Agent Desk without a browser: the block that goes into a copy of the dashboard and comes out of it again, the
   hand-off bundles, the registry outside the repository, and the commands that write the copy. What the module does
   inside a running dashboard is tested in tests/e2e/panel.test.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ok, done, atlas, atlasFile, sandbox, run, gitState, tmp, REPO } from './_t.mjs';
import { findWithheld } from '../../chrome-app/lib/scrub.mjs';
import { identity } from '../lib/read.mjs';
import { PANEL, BUNDLE, hasPanel, hasRepairs, stripPanel, installPanel, embeddedData, joins, isBundle, bundle, slim, belongs, workingName, NoSeam } from '../lib/panel.mjs';
import { KINDS, WIDTHS, tally, patterns, layoutText } from '../lib/layout.mjs';

const CLI = 'dashboard-link/cli.mjs', before = gitState(), text = atlas(), J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const count = (s, sub) => s.split(sub).length - 1, SEP = String.fromCharCode(0x2028);   /* a line separator: legal in JSON, an end of line in script */
const conn = { client: 'Example Air', identity: { atlas: 'DFW Thermal Debt Atlas', build: '4', sha256: identity(text).sha256 } };
const blueprint = slug => ({ page: { slug, title: 'A page', h1: 'A page' }, sections: [{ type: 'hero' }] });
const paid = (id, extra = {}) => bundle(Object.assign({ id, agent: 'paid-ads-specialist', title: 'A campaign', connection: conn, paid: { plan: { line: 'heat', budget: 9000, start: '2026-11-23', weeks: 10, scope: 'picks', picks: ['75150'] }, files: [{ name: 'README.md', what: 'what to do', text: '# x\n' }, { name: 'a.csv', what: 'rows', text: 'a,b\n1,2\n' }] } }, extra));
const pages = (id, extra = {}) => bundle(Object.assign({ id, agent: 'content-strategist', title: '1 page', connection: conn, content: { pages: [blueprint('ac-repair-plano-tx')] } }, extra));

/* ---------- the block goes in, and comes out ---------- */
const one = paid('paid:one'), withPanel = installPanel(text, { bundles: [one], atlas: { name: 'DFW Thermal Debt Atlas', build: '4', sha256: conn.identity.sha256.slice(0, 16) }, at: '2026-11-15T00:00:00.000Z' });
ok(!hasPanel(text) && hasPanel(withPanel) && stripPanel(withPanel) === text && stripPanel(text) === text, 'the Agent Desk goes into the dashboard as one block, and taking it out leaves the file as it was, byte for byte');
const at0 = withPanel.indexOf('<!-- leviathan:agent-desk:start'), end0 = withPanel.indexOf('<!-- leviathan:agent-desk:end -->') + '<!-- leviathan:agent-desk:end -->'.length;
ok(withPanel.slice(0, at0) === text.slice(0, at0) && withPanel.slice(end0 + 1) === text.slice(at0) && text.slice(at0).startsWith('<!-- shell boot:') && /^<!--[^>]*boot[^>]*-->\n<script>\n\/\* ==== src\/99_shell\.js/.test(withPanel.slice(end0 + 1, end0 + 200)),
  'everything outside the block is untouched, and the block sits just before the shell that builds the rail from the registered modules');
const block = withPanel.slice(at0, end0);
ok(count(block, '<script') === 3 && count(block, '</script>') === 3 && count(block, '<style') === 2 && count(block, '</style>') === 2 && count(withPanel, '<script') === count(text, '<script') + 3 && /<style id="lvp-repairs">/.test(block) && /<script id="lvp-repairs-js">/.test(block) && /<style id="lvp-style">/.test(block) && /<script type="application\/json" id="lvp-data">/.test(block) && block.indexOf('lvp-repairs') < block.indexOf('lvp-style') && hasRepairs(withPanel) && !hasRepairs(text) && embeddedData(withPanel).repairs === true,
  'the block is the layout repairs (a style sheet and one script), the Agent Desk\'s style sheet, the hand-offs as data, and the module\'s script: nothing else');
const bare = installPanel(text, { bundles: [one], repairs: false }), bareBlock = bare.slice(bare.indexOf('<!-- leviathan:agent-desk:start'), bare.indexOf('<!-- leviathan:agent-desk:end -->'));
ok(!hasRepairs(bare) && hasPanel(bare) && count(bareBlock, '<script') === 2 && count(bareBlock, '<style') === 1 && embeddedData(bare).repairs === false && embeddedData(bare).bundles.length === 1 && stripPanel(bare) === text && !/repairs to the layout/.test(bareBlock) && /repairs to the layout/.test(block),
  'the repairs can be left out: the block is then the Agent Desk alone, says so, and still comes out leaving the file as it was');
const twice = installPanel(withPanel, { bundles: [one, pages('content:pages')], at: '2026-11-15T00:00:00.000Z' });
ok(count(twice, 'leviathan:agent-desk:start') === 1 && stripPanel(twice) === text && embeddedData(twice).bundles.length === 2, 'putting it into a file that already has it gives one block, with the new hand-offs');
const d = embeddedData(withPanel);
ok(d.v === PANEL && d.installed === '2026-11-15T00:00:00.000Z' && d.atlas.build === '4' && d.bundles.length === 1 && JSON.stringify(d.bundles[0]) === JSON.stringify(one) && embeddedData(text) === null, 'the hand-offs in the block read back as they went in');
/* text in a hand-off cannot end the data block or start a tag */
const sharp = paid('paid:sharp', { title: '</script><script>window.x=1</script><!-- --> ' + SEP + ' & "quoted"' }), sharpText = installPanel(text, { bundles: [sharp] }), sharpData = sharpText.slice(sharpText.indexOf('id="lvp-data">') + 14, sharpText.indexOf('</script>', sharpText.indexOf('id="lvp-data">')));
ok(!sharpData.includes('<') && embeddedData(sharpText).bundles[0].title === sharp.title && stripPanel(sharpText) === text && count(sharpText, '<script') === count(text, '<script') + 3, 'a hand-off that carries a closing script tag stays data: no "<" is left in the block for it to become markup with');

/* ---------- what it will not be put into ---------- */
const j1 = joins('<html><body><script>var a = 1;</script></body></html>'), j2 = joins(text.replace('(function boot() {', '(function start() {')), j3 = joins(text + text.slice(text.indexOf('(function boot() {'), text.indexOf('(function boot() {') + 400));
ok(joins(text).ok && joins(withPanel).ok && !j1.ok && /no module shell this panel knows/.test(j1.why) && !j2.ok && !j3.ok, 'a file with no module shell, or with a shell this panel does not know, is not one the Agent Desk can join, and that is said');
let threw = null; try { installPanel('<html></html>'); } catch (e) { threw = e; }
ok(threw instanceof NoSeam && /Nothing was written/.test(threw.message), 'and nothing is put into such a file');
threw = null; try { stripPanel(withPanel.replace('<!-- leviathan:agent-desk:end -->', '')); } catch (e) { threw = e; }
ok(threw && /no end of one/.test(threw.message), 'a file with half a block in it is refused, not guessed at');
threw = null; try { installPanel(text, { bundles: [{ format: BUNDLE, id: 'x' }] }); } catch (e) { threw = e; }
ok(threw && /not a hand-off bundle/.test(threw.message), 'only hand-off bundles go into the block');

/* ---------- the module's own files ---------- */
const js = fs.readFileSync(path.join(REPO, 'dashboard-link', 'panel', 'agent-desk.js'), 'utf8'), css = fs.readFileSync(path.join(REPO, 'dashboard-link', 'panel', 'agent-desk.css'), 'utf8');
let parses = true; try { new vm.Script(js); } catch (e) { parses = e.message; }
ok(parses === true && !/<\/script/i.test(js) && !js.includes('<!--') && !/<\/style/i.test(css) && !(js + css).includes(SEP) && !(js + css).includes(String.fromCharCode(0x2029)), 'the module\'s script parses and holds nothing that would end its own block early', parses);
ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|\bimport\s*\(|https?:\/\//.test(js) && !/url\s*\(|@import|https?:\/\//.test(css), 'neither file can reach the network: no fetch, no socket, no address anywhere in them');
ok(!/\beval\s*\(|new Function|document\.write|insertAdjacentHTML|outerHTML/.test(js) && count(js, '.innerHTML') === 1, 'the module writes markup in one place, with no eval and no document.write');
/* outside the dashboard there is nothing for it to register with, and it does nothing */
let inert = true; try { vm.runInNewContext(js, { document: {}, window: {} }); } catch (e) { inert = e.message; }
ok(inert === true, 'run where there is no dashboard, the module does nothing and raises nothing', inert);
const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')[0].trim()).filter(Boolean).flatMap(sel => sel.split(',').map(x => x.trim()));
const SCOPED = /^\.lvp$|^\.lvp[ .]|^:root[^ ]* \.lvp |^\.rail \.in:has\(#tab-drhvac\) #tab-agents( \.[td])?$/;   // the Agent Desk itself, something inside it, or its tab
ok(selectors.length > 60 && selectors.every(x => SCOPED.test(x)) && !SCOPED.test('.lvpx') && !SCOPED.test('.module .lvp') && !SCOPED.test('.card'), 'every style rule, in a media query or out of one, is scoped to the Agent Desk or to its own tab in the rail', selectors.filter(x => !SCOPED.test(x)).slice(0, 3));

/* ---------- the layout repairs' own files ---------- */
const rcss = fs.readFileSync(path.join(REPO, 'dashboard-link', 'panel', 'atlas-repairs.css'), 'utf8'), rjs = fs.readFileSync(path.join(REPO, 'dashboard-link', 'panel', 'atlas-repairs.js'), 'utf8');
parses = true; try { new vm.Script(rjs); } catch (e) { parses = e.message; }
ok(parses === true && !/<\/script/i.test(rjs) && !rjs.includes('<!--') && !/<\/style/i.test(rcss) && !(rjs + rcss).includes(SEP) && !(rjs + rcss).includes(String.fromCharCode(0x2029)), 'the repair script parses, and neither repair file holds anything that would end its block early', parses);
ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|\bimport\s*\(|https?:\/\//.test(rjs) && !/url\s*\(|@import|https?:\/\//.test(rcss) && !/\beval\s*\(|new Function|document\.write|innerHTML|outerHTML|insertAdjacentHTML/.test(rjs), 'neither can reach the network, and the script writes no markup: it moves and hides text that is already there');
inert = true; try { vm.runInNewContext(rjs, {}); vm.runInNewContext(rjs, { document: { readyState: 'complete', querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, body: {} }, window: { addEventListener() { } }, setTimeout() { return 1; } }); } catch (e) { inert = e.message; }
ok(inert === true, 'run where there is no page, or a page with no charts and no observer, the repair script does nothing and raises nothing', inert);
const rules = rcss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')).filter(p => p.length === 2 && p[0].trim());
ok(rules.length >= 10 && !/!important/.test(rcss) && rules.every(([, body]) => !/(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)/.test(body)) && /^\/\* ==== leviathan layout repairs ==== \*\//.test(rcss),
  'the repair sheet hides nothing and forces nothing: no rule takes anything off the page, and none is marked important', rules.length);

/* ---------- bundles ---------- */
ok(isBundle(one) && one.format === BUNDLE && one.client === 'Example Air' && one.atlas.build === '4' && one.atlas.sha256 === conn.identity.sha256.slice(0, 16) && isBundle(pages('content:x')) && !isBundle({ format: BUNDLE, id: 'x', paid: {} }) && !isBundle({ format: BUNDLE, id: 'x', content: { pages: [{}] } }) && !isBundle({ format: 'other', id: 'x', paid: { plan: {} } }) && !isBundle(null),
  'a hand-off bundle names its agent, its client and the dashboard it was made for, and holds a plan or at least one page');
threw = null; try { bundle({ id: 'x', agent: 'a', paid: {} }); } catch (e) { threw = e; }
ok(threw && /needs an id and either a plan/.test(threw.message) && slim(one).paid.files.every(f => f.text === null && f.name && f.what) && one.paid.files[0].text === '# x\n' && slim(pages('content:y')).content.pages.length === 1, 'a bundle with neither is refused; a slimmed one keeps the names of its files and drops their text');
ok(belongs(one, conn) && !belongs(one, Object.assign({}, conn, { client: 'Another Shop' })) && !belongs(one, { client: 'Example Air', identity: { atlas: 'Houston Thermal Debt Atlas' } }) && belongs(one, { client: 'Example Air', identity: { atlas: 'DFW Thermal Debt Atlas', build: '7', sha256: 'f'.repeat(64) } }),
  'a hand-off belongs in the dashboard of the same client and the same atlas, whatever its build, and in no other client\'s');
ok(workingName(conn) === 'DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk.html' && workingName({ identity: {} }) === 'Dashboard_Agent_Desk.html', 'the copy is named after the dashboard it is a copy of');

/* ---------- the commands ---------- */
const { home, env } = sandbox(), file = atlasFile(), at = (...p) => path.join(home, ...p);
let r = run(CLI, ['panel'], env); ok(r.code === 2 && /No dashboard is connected/.test(r.err), 'panel needs a connected dashboard, and says so');
r = run(CLI, ['connect', file, '--no-live'], env, { json: true });
const c = r.json, copy = at('dashboard', 'DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk.html'), kept = at('dashboard', 'atlas.html');
r = run(CLI, ['panel'], env);
ok(r.code === 0 && /The dashboard with the Agent Desk in it {2}-> .*DFW_Thermal_Debt_Atlas_Build_4_Agent_Desk\.html/.test(r.out) && /a copy: the dashboard file that was connected is not written to/.test(r.out) && /No hand-off is in it yet/.test(r.out) && /Not opened to check it: LEVIATHAN_NO_LIVE is set\./.test(r.out) && stripPanel(fs.readFileSync(copy, 'utf8')) === text && fs.readFileSync(kept, 'utf8') === text && fs.readFileSync(file, 'utf8') === text,
  'panel: writes the copy beside the connected dashboard, says nothing is in it yet and that it was not opened to check, and leaves the dashboard itself alone', r.err);
/* the layout repairs: in unless asked otherwise, and the choice is kept for the next time the copy is written */
const rd = f => fs.readFileSync(f, 'utf8');
ok(/Layout repairs: in\. The copy also fixes places where the dashboard's own text and controls overlapped \(panel --no-repairs leaves them out\)\./.test(r.out) && hasRepairs(rd(copy)) && !fs.existsSync(at('dashboard', 'panel.json')), 'the copy carries the layout repairs, and the command says so and how to leave them out');
r = run(CLI, ['panel', '--no-repairs'], env);
ok(r.code === 0 && /Layout repairs: left out, as asked\. The dashboard's own modules are as they were delivered \(panel --repairs puts the repairs back\)\./.test(r.out) && !hasRepairs(rd(copy)) && hasPanel(rd(copy)) && stripPanel(rd(copy)) === text && J(at('dashboard', 'panel.json')).repairs === false, '--no-repairs leaves them out: the copy is the dashboard as delivered plus the Agent Desk');
r = run(CLI, ['panel', '--json'], env); ok(r.code === 0 && JSON.parse(r.out).repairs === false && !hasRepairs(rd(copy)), 'and they stay out the next time the copy is written, by a person or by an agent');
r = run(CLI, ['panel', '--repairs'], env); ok(r.code === 0 && /Layout repairs: in\./.test(r.out) && hasRepairs(rd(copy)) && J(at('dashboard', 'panel.json')).repairs === true && stripPanel(rd(copy)) === text, '--repairs puts them back');
r = run(CLI, ['panel', '--repairs', '--no-repairs'], env); ok(r.code === 2 && /cannot both be asked for/.test(r.err), 'asking for both is refused');
r = run(CLI, ['layout'], env); ok(r.code === 3 && /no browser is available here/.test(r.err) && !/\.mjs:\d+/.test(r.err), 'layout runs the dashboard, so with no browser it stops with its own exit code and a plain message');
r = run(CLI, ['layout', '--widths', '12'], env); ok(r.code === 2 && /--widths takes window widths in pixels/.test(r.err), 'and a width that is no window width is refused');
/* hand-offs on file: this client's go in, another client's do not */
const reg = at('dashboard', 'handoffs'); fs.mkdirSync(reg, { recursive: true });
const mine = (id, made, extra) => Object.assign(JSON.parse(JSON.stringify(id.startsWith('paid') ? paid(id) : pages(id))), { client: c.client, made, atlas: { name: c.identity.atlas, build: c.identity.build, sha256: c.identity.sha256.slice(0, 16) } }, extra || {});
const put = b => fs.writeFileSync(path.join(reg, b.id.replace(/[^a-z0-9]+/gi, '-') + '.json'), JSON.stringify(b));
put(mine('paid:first', '2026-11-10T10:00:00.000Z')); put(mine('content:pages', '2026-11-12T10:00:00.000Z')); put(mine('paid:theirs', '2026-11-13T10:00:00.000Z', { client: 'Another Shop' })); fs.writeFileSync(path.join(reg, 'junk.json'), '{not json');
r = run(CLI, ['panel', '--json'], env);
const v = JSON.parse(r.out), inCopy = embeddedData(fs.readFileSync(copy, 'utf8'));
ok(r.code === 0 && v.bundles.map(b => b.id).join() === 'content:pages,paid:first' && v.others === 1 && inCopy.bundles.length === 2 && inCopy.bundles.every(b => b.client === c.client) && inCopy.atlas.sha256 === c.identity.sha256.slice(0, 16) && v.opened === null && v.ok === true,
  'the copy holds this client\'s hand-offs, newest first; one made for another client\'s dashboard stays out, and is counted');
r = run(CLI, ['panel'], env);
ok(/2 hand-offs in it, newest first:/.test(r.out) && /content strategist\s+2026-11-12 10:00 {2}1 page {3}\(content:pages\)/.test(r.out) && /1 hand-off on this machine belongs to another client's dashboard and was not put in this one\./.test(r.out), 'and the command says so in words');
/* the copy is never the dashboard, and nothing but an earlier copy is written over */
const elsewhere = at('my-dashboard.html'); fs.writeFileSync(elsewhere, text);
r = run(CLI, ['panel', '--out', elsewhere], env); ok(r.code === 2 && /is already there and is not a copy this panel made/.test(r.err) && fs.readFileSync(elsewhere, 'utf8') === text, 'a dashboard file that is already there is not written over');
r = run(CLI, ['panel', '--out', kept], env); ok(r.code === 2 && /is the dashboard file itself/.test(r.err) && fs.readFileSync(kept, 'utf8') === text, 'nor is the connected dashboard itself');
r = run(CLI, ['panel', '--out', path.join(REPO, 'dashboard-link', 'copy.html')], env); ok(r.code === 2 && /inside the repository/.test(r.err) && !fs.existsSync(path.join(REPO, 'dashboard-link', 'copy.html')), 'nor anything inside the repository');
const named = at('for-the-owner.html');
r = run(CLI, ['panel', '--out', named], env); ok(r.code === 0 && stripPanel(fs.readFileSync(named, 'utf8')) === text && run(CLI, ['panel', '--out', named], env).code === 0, 'a new name is fine, and so is writing over a copy this panel made before');
/* a large registry: the newest go in whole, older ones without their files' text, the oldest are left out */
const big = 'x'.repeat(1500000);
for (let i = 0; i < 13; i++) put(mine('paid:big-' + String(i).padStart(2, '0'), `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, { paid: { plan: { line: 'heat', budget: 1 }, files: [{ name: 'big.csv', what: 'rows', text: big }] } }));
r = run(CLI, ['panel', '--json'], env);
const w = JSON.parse(r.out), held = embeddedData(fs.readFileSync(copy, 'utf8')).bundles;
ok(w.bundles.length === 12 && w.leftOut.length === 3 && w.slimmed.length > 0 && w.slimmed.length < 12 && held.filter(b => b.paid && b.paid.files.some(f => f.text === big)).length === 12 - 2 - w.slimmed.length && held.filter(b => b.paid && b.paid.files.every(f => f.text === null)).length === w.slimmed.length && w.bytes < text.length + 8e6 && stripPanel(fs.readFileSync(copy, 'utf8')) === text,
  'with many hand-offs on file the copy stays a size that opens: twelve at most, the newest whole, older ones without the text of their bulk files, and the command says which', { n: w.bundles.length, slimmed: w.slimmed.length, left: w.leftOut.length, mb: Math.round(w.bytes / 1e5) / 10 });
r = run(CLI, ['panel'], env); ok(/older hand-offs? (is|are) in it without the text of the bulk files/.test(r.out) && /3 older still were left out: .*Forget what is finished with: panel --forget <id>\./.test(r.out), 'and in words');
/* forgetting */
r = run(CLI, ['panel', '--forget', 'paid:nope'], env); ok(r.code === 2 && /No hand-off "paid:nope" is on file\. panel lists what is\./.test(r.err) && !/\.mjs:\d+/.test(r.err), 'forgetting a hand-off that is not on file is refused in plain words');
r = run(CLI, ['panel', '--forget'], env); ok(r.code === 2 && /--forget takes the id of a hand-off/.test(r.err), 'and --forget needs to be told which');
r = run(CLI, ['panel', '--forget', 'paid:first'], env);
ok(r.code === 0 && /^Forgotten: paid:first\. The folders the agents built are still where they were\./.test(r.out) && !fs.existsSync(path.join(reg, 'paid-first.json')) && !embeddedData(fs.readFileSync(copy, 'utf8')).bundles.some(b => b.id === 'paid:first'), 'one hand-off is forgotten by its id, and the copy is written again without it');
r = run(CLI, ['panel', '--forget', 'all', '--json'], env);
ok(r.code === 0 && JSON.parse(r.out).bundles.length === 0 && JSON.parse(r.out).forgotten.length === 15 && JSON.parse(r.out).others === 0 && fs.readdirSync(reg).join() === 'junk.json', '"all" forgets every one, whoever it was for, and leaves alone a file that was never a hand-off');
ok(run(CLI, ['help'], env).out.includes('panel [--out file] [--forget id|all] [--no-live] [--no-repairs | --repairs]') && run(CLI, ['help'], env).out.includes('layout [--widths 1440,1190,...] [--quick] [--plain] [--modules key,key]'), 'help lists the panel and layout commands');

/* ---------- a copy with the Agent Desk in it connects as the dashboard it is ---------- */
put(mine('content:pages', '2026-11-12T10:00:00.000Z')); run(CLI, ['panel'], env);
const two = sandbox(); r = run(CLI, ['connect', copy, '--no-live'], two.env, { json: true });
ok(r.code === 0 && r.json.identity.sha256 === c.identity.sha256 && r.json.panel.carried === 1 && r.json.panel.kept === 1 && fs.readFileSync(path.join(two.home, 'dashboard', 'atlas.html'), 'utf8') === text && J(path.join(two.home, 'dashboard', 'handoffs', 'content-pages.json')).id === 'content:pages',
  'connect: the copy has the fingerprint of the dashboard it was made from, the file kept is the dashboard without the block, and the hand-off inside it is put on file', r.err.split('\n')[0]);
r = run(CLI, ['connect', copy, '--no-live'], two.env); ok(/The file carried the Agent Desk\. It was read as the dashboard without it\. Of the one hand-off inside it, none was put on file here: the rest is on file already, or was made for another client's dashboard\./.test(r.out), 'connecting it again says so, and does not put on file what is already there', r.out.split('\n').find(l => /carried/.test(l)));
r = run(CLI, ['connect', file, '--no-live'], two.env, { json: true }); ok(r.code === 0 && r.json.panel === undefined, 'a dashboard without the block connects as before');

/* ---------- the layout sweep reads its own findings (the sweep itself needs a browser: tests/e2e/repairs.test.mjs) ---------- */
const finding = (type, extra = {}) => Object.assign({ type, a: 'div#card12 > span', aText: 'one thing', b: type === 'overlap' ? 'div#card12 > b' : '', bText: type === 'overlap' ? 'another' : 'a note', box: { x: 1, y: 2, w: 3, h: 4 } }, extra);
const swept = { runs: [{ w: 1190, mod: 'index', view: 'as it opens', items: 40, issues: KINDS.map(k => finding(k)), wider: 0 }, { w: 820, mod: 'index', view: 'as it opens', items: 40, issues: [finding('overlap'), finding('labels', { n: 6, aText: '6 pairs of 38 labels' }), finding('struck', { n: 4, aText: '4 labels of 7' })], wider: 3 }, { w: 820, mod: 'desk', view: 'as it opens', items: 9, issues: [], wider: 0 }], pageErrors: [] };
const tl = tally(swept), pt = patterns(swept), said = layoutText(swept, { name: 'An atlas · Build 4', repaired: false });
ok(KINDS.length === 11 && new Set(KINDS).size === 11 && tl.total === KINDS.length + 1 + 6 + 4 && tl.byKind.labels === 7 && tl.byKind.struck === 5 && tl.byKind.overlap === 2 && tl.byModule.index.overlap === 2 && tl.views === 3 && tl.widest === 3 && tl.errors === 0,
  'the sweep counts what it found by kind and by module, a chart once for each label of it that is wrong, and keeps how far a page ran past its window', tl.total);
ok(pt.length === KINDS.length && pt[0].kind === 'labels' && pt[0].n === 7 && pt.find(p => p.kind === 'overlap').widths.join() === '1190,820' && /^div#cardN > span/.test(pt[0].where), 'findings that share a place are one line, the place named without the number in its id, most first');
ok(KINDS.every(k => !said.includes('undefined')) && /An atlas · Build 4, as it is, without the layout repairs: 3 views measured at 1190, 820 px wide\./.test(said) && /chart drawn past its own frame/.test(said) && /tick box stretched to a field's width/.test(said) && /chart label with a line through it or on a point/.test(said) && /wider than the window by up to 3 px/.test(said), 'the report names every kind of finding in words, says which file it measured and at which widths');
ok(/Nothing overlaps, crowds or spills in any of them\./.test(layoutText({ runs: [{ w: 1190, mod: 'index', view: 'as it opens', items: 3, issues: [], wider: 0 }], pageErrors: [] }, { name: 'An atlas', repaired: true })) && WIDTHS.length === 6 && WIDTHS.every(w => w >= 320 && w <= 1600), 'and a clean sweep says so in one line');

/* ---------- nothing here names a client, and nothing landed in the repository ---------- */
ok(findWithheld(js + css + rjs + rcss + fs.readFileSync(path.join(REPO, 'dashboard-link', 'lib', 'panel.mjs'), 'utf8') + fs.readFileSync(path.join(REPO, 'dashboard-link', 'lib', 'layout.mjs'), 'utf8'), 1).length === 0, 'the panel\'s files, the repairs and the sweep carry no withheld name');
ok(gitState() === before, 'the repository is as it was: nothing a command wrote landed in it');
done();
